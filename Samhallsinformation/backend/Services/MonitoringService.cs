namespace Samhallsinformation.Services;

using Samhallsinformation.Application.Monitoring;

// Övervakning och larm (V1-9): utvärderar reglerna (Application/Monitoring) var 5:e minut och
// skapar/uppdaterar/löser larm i AdminAlerts, med mejl till admins vid nya larm. Bara ett timer-skal —
// själva cykeln är AdminAlertCycle.RunAsync så den kan köras direkt i test. Samma mönster som
// UserDeletionBackgroundService: ny scope per cykel, och ett undantag dödar aldrig tjänsten.
public class MonitoringService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MonitoringService> _logger;
    private readonly TimeProvider _time;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    // Väntetid före första cykeln: ingestorn hämtar sina källor direkt vid start, och en cykel
    // omedelbart efter en omstart skulle se alla källor som "inte hämtade" (falsklarm vid varje deploy).
    private readonly TimeSpan _startDelay = TimeSpan.FromMinutes(2);

    public MonitoringService(IServiceScopeFactory scopeFactory, ILogger<MonitoringService> logger, TimeProvider time)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _time = time;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MonitoringService started. Interval: {Interval}", _interval);

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
    /// En cykel med all felhantering: sväljer (och loggar) alla undantag utom nedstängning, så
    /// anropande loop aldrig dör. Public så själva "tjänsten dör inte"-egenskapen kan testas.
    /// </summary>
    public async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var cycle = scope.ServiceProvider.GetRequiredService<AdminAlertCycle>();
            await cycle.RunAsync(_time.GetUtcNow().UtcDateTime, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MonitoringService misslyckades — försöker igen om {Interval}", _interval);
        }
    }
}
