namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Application.Uppdateringar;
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
                var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();
                var frontendUrl = scope.ServiceProvider.GetRequiredService<IConfiguration>()["FRONTEND_URL"]
                    ?? "https://samhallsinformation.se";
                await ExecuteDueAsync(db, aktivitetslogg, stoppingToken, push, frontendUrl);
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

    // Hur länge en automatiskt skapad "Nyhet"-banderoll syns efter lansering.
    // Beslut 2026-10-08 nämnde "3/7/14 dagar framåt" utan att slå fast ett
    // exakt tal — 7 vald som mittenvärde, lätt att justera.
    private const int BannerLängdDagar = 7;

    public static async Task ExecuteDueAsync(
        AppDbContext db, IAktivitetsloggService aktivitetslogg, CancellationToken ct = default,
        IPushNotificationService? push = null, string frontendUrl = "https://samhallsinformation.se")
    {
        var now = DateTime.UtcNow;
        var due = await db.Uppdateringar
            .Where(u => u.SchemalagdPubliceringUtc != null && u.SchemalagdPubliceringUtc <= now)
            .ToListAsync(ct);

        foreach (var uppdatering in due)
        {
            var flaggor = FeatureFlagActivation.DeserialiseraFlaggor(uppdatering.SchemalagdaFlaggorJson);
            await FeatureFlagActivation.ActivateFlagsAsync(
                db, aktivitetslogg, flaggor,
                $"Del av schemalagd lansering: {uppdatering.Titel}", AktörTyper.System, ct);

            // Publiceras bara om posten faktiskt har innehåll — en ren
            // flagg-aktivering utan changelog-text ska inte dyka upp som en
            // tom post i Uppdateringar/Nyheter. Samma spärr gäller push och
            // banderoll nedan (Beslut 2026-10-08) — inget innehåll, inget att
            // pusha eller visa en banderoll om.
            var punkter = await db.UppdateringsPunkter.Where(p => p.UppdateringId == uppdatering.Id).ToListAsync(ct);
            var harPunkter = punkter.Count > 0;
            if (harPunkter && !uppdatering.Publicerad)
            {
                uppdatering.Publicerad = true;
                await aktivitetslogg.LogAsync(
                    AktörTyper.System, LoggTyper.Konfiguration,
                    $"Uppdatering publicerad automatiskt — {uppdatering.Titel}", "Schemalagd publicering nådd");
            }

            // Del 2 av Schemalagd lanserings "Ny version"-tillägg: push och
            // banderoll skapas HÄR, vid lanseringstidpunkten — inte när
            // posten sparas (Beslut 2026-10-08). Tas schemat bort i förväg
            // blir det alltså ingenting kvar att städa bort.
            if (harPunkter && uppdatering.SkickaPush && push != null)
            {
                var version = uppdatering.PushVersion ?? "";
                var meddelande = uppdatering.PushMeddelande ?? uppdatering.Titel;
                var mottagare = await PushDispatcher.DispatchNewVersionAsync(db, push, frontendUrl, version, meddelande, ct);
                await aktivitetslogg.LogAsync(
                    AktörTyper.System, LoggTyper.Push,
                    $"Push skickad automatiskt — Ny version {version}", $"{mottagare} mottagare ({uppdatering.Titel})");
            }

            if (harPunkter && uppdatering.VisaBanderoll)
            {
                // Målgruppen härleds från punkternas "Syns för" — minst en
                // punkt synlig för besökare ("alla") gör banderollen bred,
                // annars (allt "inloggade") riktas den bara till inloggade.
                var målgrupp = punkter.Any(p => p.Synlighet == UppdateringsVärden.SynlighetAlla) ? "Alla" : "Användare";
                db.MaintenanceBanners.Add(new MaintenanceBanner
                {
                    Id        = Guid.NewGuid(),
                    Message   = uppdatering.Titel,
                    Rubrik    = "Nytt på Samhällsinformation",
                    Stil      = "Nyhet",
                    LankUrl   = "/uppdateringar",
                    Audience  = målgrupp,
                    StartUtc  = now,
                    EndUtc    = now.AddDays(BannerLängdDagar),
                    CreatedAt = now,
                });
                await aktivitetslogg.LogAsync(
                    AktörTyper.System, LoggTyper.Konfiguration,
                    $"Banderoll skapad automatiskt — {uppdatering.Titel}", $"Målgrupp: {målgrupp}");
            }

            // Nollställer BÅDE tidsstämpeln och flagg-listan — en post som
            // redan bearbetats ska inte visa kvarvarande flaggor som om de
            // fortfarande väntade (upptäckt i code review: tidigare
            // nollställdes bara tidsstämpeln, vilket lämnade en missvisande
            // flagg-lista kvar i GET-svaret).
            uppdatering.SchemalagdPubliceringUtc = null;
            uppdatering.SchemalagdaFlaggorJson   = null;
            uppdatering.UpdatedAt = now;
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
