namespace Samhallsinformation.Services;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Kör schemalagda "lanseringar" (Uppdateringar-poster med SchemalagdPublicering
// Utc satt) — aktiverar kopplade feature-flaggor och publicerar posten (om den
// har innehåll). Modellerad efter SupportScheduledActionService (60s-poll,
// statisk ExecuteDueAsync separat från loopen), inte IngestorBackgroundService
// (fel mall — den är byggd för extern RSS-hämtning, inte tidsstämpel-polling).
public class ScheduledReleaseBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScheduledReleaseBackgroundService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(60);

    public ScheduledReleaseBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ScheduledReleaseBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var aktivitetslogg = scope.ServiceProvider.GetRequiredService<IAktivitetsloggService>();
                await ExecuteDueAsync(db, aktivitetslogg, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ScheduledReleaseBackgroundService misslyckades — försöker igen om {Interval}", _interval);
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    public static async Task ExecuteDueAsync(AppDbContext db, IAktivitetsloggService aktivitetslogg, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await db.Uppdateringar
            .Where(u => u.SchemalagdPubliceringUtc != null && u.SchemalagdPubliceringUtc <= now)
            .ToListAsync(ct);

        foreach (var uppdatering in due)
        {
            var flaggor = string.IsNullOrEmpty(uppdatering.SchemalagdaFlaggorJson)
                ? []
                : JsonSerializer.Deserialize<List<string>>(uppdatering.SchemalagdaFlaggorJson) ?? [];

            foreach (var key in flaggor)
            {
                var flagg = await db.FeatureFlagOverrides.FindAsync([key], ct);
                if (flagg == null)
                {
                    flagg = new FeatureFlagOverride { Key = key };
                    db.FeatureFlagOverrides.Add(flagg);
                }
                flagg.Value = true;
                flagg.RedoAttLanseras = false;

                await aktivitetslogg.LogAsync(
                    AktörTyper.System, LoggTyper.Konfiguration,
                    $"Feature flag aktiverad automatiskt — {key}",
                    $"Del av schemalagd lansering: {uppdatering.Titel}");
            }

            // Publiceras bara om posten faktiskt har innehåll — en ren
            // flagg-aktivering utan changelog-text ska inte dyka upp som en
            // tom post i Uppdateringar/Nyheter.
            var harPunkter = await db.UppdateringsPunkter.AnyAsync(p => p.UppdateringId == uppdatering.Id, ct);
            if (harPunkter && !uppdatering.Publicerad)
            {
                uppdatering.Publicerad = true;
                await aktivitetslogg.LogAsync(
                    AktörTyper.System, LoggTyper.Konfiguration,
                    $"Uppdatering publicerad automatiskt — {uppdatering.Titel}", "Schemalagd publicering nådd");
            }

            uppdatering.SchemalagdPubliceringUtc = null; // idempotens-vakt — bearbetad, oavsett Publicerad-utfall
            uppdatering.UpdatedAt = now;
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
