namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;

public class IngestorBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<IngestorBackgroundService> _logger;
    private readonly IConfiguration _config;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    public IngestorBackgroundService(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        ILogger<IngestorBackgroundService> logger,
        IConfiguration config)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("IngestorBackgroundService started. Interval: {Interval}", _interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await IngestAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IngestAsync failed — retrying after {Interval}", _interval);
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    /// <summary>
    /// Regeln för om en källa ska hämtas: en <see cref="Source"/>-rad med IsActive=false pausar
    /// hämtningen (avaktivering i admin). Saknas raden i databasen hämtas källan som förut —
    /// dedikerade ingestorer har en egen in-code-Source och seedas normalt, så en saknad rad är
    /// ett undantagsläge där vi hellre hämtar än tystnar. IsPublished spelar ingen roll här:
    /// opublicerade sandlådekällor ska fortsatt hämtas så de kan testas.
    /// </summary>
    public static bool ShouldIngest(Source? dbSource) => dbSource == null || dbSource.IsActive;

    // Public så en cykel kan köras direkt i test (loopen i ExecuteAsync är bara ett timer-skal).
    public async Task IngestAsync(CancellationToken ct)
    {
        // Yttre scope används ENBART för att läsa upp vilka källor som ska köras. Själva
        // hämtningen/synken/pushen för varje källa körs i en egen scope med egen AppDbContext
        // (IngestSourceAsync), så ett misslyckat SaveChanges för en källa aldrig kan lämna
        // ogiltiga entiteter kvar i en change tracker som nästa källa delar (V3-3, E3#3).
        using var scope = _scopeFactory.CreateScope();
        var db        = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dedicated = scope.ServiceProvider.GetRequiredService<IEnumerable<IIngestor>>().ToList();
        var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";

        // En delad tidsstämpel för hela cykeln, satt en gång — inte
        // IngestorRunLog.RunAt:s egen DateTime.UtcNow-default per rad. Låter
        // AdminActivityLogController gruppera alla källors rader från samma
        // cykel till EN aktivitetsloggrad istället för en per källa.
        var cycleStart = DateTime.UtcNow;

        var dedicatedIds = dedicated.Select(i => i.Source.Id).ToHashSet();

        // AsNoTracking: den yttre kontexten är bara en läsare, och GenericRssIngestor bär
        // bara Source-värdena (inga entiteter delas med källornas egna kontexter).
        var genericSources = await db.Sources
            .AsNoTracking()
            .Where(s => s.IsActive && s.Type == SourceType.RSS && s.Url != null && !dedicatedIds.Contains(s.Id))
            .ToListAsync(ct);

        var genericIngestors = genericSources
            .Select(s => new GenericRssIngestor(_httpClientFactory.CreateClient(), s))
            .ToList<IIngestor>();

        // De dedikerade ingestorernas in-code-Source har hårdkodat IsActive=true, så
        // adminens IsActive på DB-raden måste slås upp per cykel. (Generiska källor är
        // redan filtrerade på IsActive ovan.) Rad saknas -> ingen post i dictionaryn ->
        // ShouldIngest(null) = true, dvs. beteende som förut.
        var dedicatedRows = await db.Sources
            .AsNoTracking()
            .Where(s => dedicatedIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var allIngestors = dedicated.Concat(genericIngestors);

        foreach (var ingestor in allIngestors)
        {
            var sourceId = ingestor.Source.Id;

            dedicatedRows.TryGetValue(sourceId, out var dbRow);
            if (!ShouldIngest(dbRow))
            {
                // Medvetet varken IngestorRunLog eller LastFetchError: en pausad källa är
                // ett adminbeslut, inte ett fel.
                _logger.LogInformation("Skipping {Source} (id {SourceId}): Source.IsActive=false",
                    ingestor.Source.Name, sourceId);
                continue;
            }

            await IngestSourceAsync(ingestor, cycleStart, frontendUrl, ct);
        }
    }

    // En källas hela cykel i en egen DI-scope. Kastar aldrig (utom vid avbrytande) — ett fel
    // loggas och skrivs till LastFetchError/IngestorRunLog via en ANNAN, färsk scope.
    private async Task IngestSourceAsync(IIngestor ingestor, DateTime cycleStart, string frontendUrl, CancellationToken ct)
    {
        var sourceId = ingestor.Source.Id;
        var sourceName = ingestor.Source.Name;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db   = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

            var (inserted, _, insertedEvents) = await EventSync.SyncAsync(db, ingestor, overwriteExisting: false, ct, _logger);
            _logger.LogInformation("Saved {Count} new events for {Source}", inserted, sourceName);

            var dbSource = await db.Sources.FindAsync([sourceId], ct);
            if (dbSource != null)
            {
                dbSource.LastFetchedAt  = DateTime.UtcNow;
                dbSource.LastFetchError = null;
            }

            db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = sourceId, RunAt = cycleStart, Success = true, EventsInserted = inserted });

            await db.SaveChangesAsync(ct);

            try
            {
                await PushDispatcher.DispatchNewEventsAsync(db, push, frontendUrl, sourceId, inserted, insertedEvents, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // Push-fel ska aldrig markera källan som trasig — bara loggas. Hämtningen är
                // redan sparad ovan och scopen slängs efteråt, så en smutsig tracker här
                // kan inte nå nästa källa.
                _logger.LogError(ex, "Push dispatch failed for {Source}", sourceName);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during ingestion for {Source}", sourceName);
            await RecordFailureAsync(sourceId, sourceName, ex, cycleStart, ct);
        }
    }

    // Skriver felet till Source.LastFetchError + en IngestorRunLog-rad med en färsk scope/kontext
    // (den trasiga kontextens tracker kastas). Egen try/catch: felloggningen får aldrig fälla loopen.
    private async Task RecordFailureAsync(int sourceId, string sourceName, Exception error, DateTime cycleStart, CancellationToken ct)
    {
        try
        {
            var felmeddelande = error.Message.Length > 500 ? error.Message[..500] : error.Message;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var dbSource = await db.Sources.FindAsync([sourceId], ct);
            if (dbSource != null)
                dbSource.LastFetchError = felmeddelande;

            db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = sourceId, RunAt = cycleStart, Success = false, ErrorMessage = felmeddelande });

            await db.SaveChangesAsync(ct);
        }
        catch (Exception logEx)
        {
            _logger.LogError(logEx, "Could not record ingestion failure for {Source}", sourceName);
        }
    }
}
