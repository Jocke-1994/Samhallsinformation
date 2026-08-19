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

    private async Task IngestAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db        = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var push      = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();
        var dedicated = scope.ServiceProvider.GetRequiredService<IEnumerable<IIngestor>>().ToList();
        var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";

        var dedicatedIds = dedicated.Select(i => i.Source.Id).ToHashSet();

        var genericSources = await db.Sources
            .Where(s => s.IsActive && s.Type == SourceType.RSS && s.Url != null && !dedicatedIds.Contains(s.Id))
            .ToListAsync(ct);

        var genericIngestors = genericSources
            .Select(s => new GenericRssIngestor(_httpClientFactory.CreateClient(), s))
            .ToList<IIngestor>();

        var allIngestors = dedicated.Concat(genericIngestors);

        foreach (var ingestor in allIngestors)
        {
            var sourceId = ingestor.Source.Id;
            try
            {
                var (inserted, _, insertedEvents) = await EventSync.SyncAsync(db, ingestor, overwriteExisting: false, ct);
                _logger.LogInformation("Saved {Count} new events for {Source}",
                    inserted, ingestor.Source.Name);

                var dbSource = await db.Sources.FindAsync([sourceId], ct);
                if (dbSource != null)
                {
                    dbSource.LastFetchedAt  = DateTime.UtcNow;
                    dbSource.LastFetchError = null;
                }

                db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = sourceId, Success = true, EventsInserted = inserted });

                await db.SaveChangesAsync(ct);

                try
                {
                    await PushDispatcher.DispatchNewEventsAsync(db, push, frontendUrl, sourceId, inserted, insertedEvents, ct);
                }
                catch (Exception ex)
                {
                    // Push-fel ska aldrig markera källan som trasig — bara loggas.
                    _logger.LogError(ex, "Push dispatch failed for {Source}", ingestor.Source.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during ingestion for {Source}", ingestor.Source.Name);
                try
                {
                    var felmeddelande = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;

                    var dbSource = await db.Sources.FindAsync([sourceId], ct);
                    if (dbSource != null)
                        dbSource.LastFetchError = felmeddelande;

                    db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = sourceId, Success = false, ErrorMessage = felmeddelande });

                    await db.SaveChangesAsync(ct);
                }
                catch { /* loggfel ska inte krascha loopen */ }
            }
        }
    }
}
