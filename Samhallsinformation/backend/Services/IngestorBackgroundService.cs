namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;

public class IngestorBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IngestorBackgroundService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    public IngestorBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<IngestorBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("IngestorBackgroundService started. Interval: {Interval}", _interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            await IngestAsync(stoppingToken);
            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task IngestAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db        = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ingestors = scope.ServiceProvider.GetRequiredService<IEnumerable<IIngestor>>();

        foreach (var ingestor in ingestors)
        {
            try
            {
                var events = await ingestor.FetchEventsAsync();
                _logger.LogInformation("Fetched {Count} events from {Source}",
                    events.Count, ingestor.Source.Name);

                var externalIds = events.Select(e => e.ExternalId).ToList();
                var existingIds = await db.Events
                    .Where(e => externalIds.Contains(e.ExternalId))
                    .Select(e => e.ExternalId)
                    .ToListAsync(ct);

                var newEvents = events
                    .Where(e => !existingIds.Contains(e.ExternalId))
                    .ToList();

                if (newEvents.Count > 0)
                {
                    db.Events.AddRange(newEvents);
                    await db.SaveChangesAsync(ct);
                    _logger.LogInformation("Saved {Count} new events (skipped {Skipped} duplicates)",
                        newEvents.Count, events.Count - newEvents.Count);
                }
                else
                {
                    _logger.LogInformation("No new events (all {Count} were duplicates)", events.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during ingestion for {Source}", ingestor.Source.Name);
            }
        }
    }
}
