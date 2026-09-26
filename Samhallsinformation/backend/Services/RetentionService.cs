namespace Samhallsinformation.Services;

using Samhallsinformation.Application.Retention;
using Samhallsinformation.Data;

// Retention för loggtabeller (V4-1a, E2#6): städar IngestorRunLogs/PushDispatchClaims (se DataRetention).
// Bara ett timer-skal — själva städningen är DataRetention.PurgeAsync. Samma mönster som MonitoringService:
// ny scope per cykel, och ett undantag dödar aldrig tjänsten.
public class RetentionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RetentionService> _logger;
    private readonly TimeProvider _time;
    private readonly TimeSpan _interval = TimeSpan.FromHours(6);

    // Väntetid före första körningen så att uppstarten (migreringar, seed, första ingest) inte konkurrerar
    // med en eventuellt stor första radering.
    private readonly TimeSpan _startDelay = TimeSpan.FromMinutes(5);

    public RetentionService(IServiceScopeFactory scopeFactory, ILogger<RetentionService> logger, TimeProvider time)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _time = time;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RetentionService started. Start delay: {StartDelay}, interval: {Interval}", _startDelay, _interval);

        try
        {
            await Task.Delay(_startDelay, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                await RunOnceAsync(stoppingToken);
                await Task.Delay(_interval, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal nedstängning.
        }
    }

    /// <summary>
    /// En körning med all felhantering: sväljer (och loggar) alla undantag utom nedstängning, så anropande
    /// loop aldrig dör. Public så själva "tjänsten dör inte"-egenskapen kan testas.
    /// </summary>
    public async Task<RetentionResult> RunOnceAsync(CancellationToken ct, TimeSpan? pauseBetweenBatches = null, int batchSize = DataRetention.DefaultBatchSize)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await DataRetention.PurgeAsync(
                db, _time.GetUtcNow().UtcDateTime, _logger, batchSize, pauseBetweenBatches, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RetentionService misslyckades — försöker igen om {Interval}", _interval);
            return default;
        }
    }
}
