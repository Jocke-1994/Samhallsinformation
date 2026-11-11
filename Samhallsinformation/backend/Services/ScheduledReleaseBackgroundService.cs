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
        // Del 3: en post kan bli "due" av TVÅ oberoende skäl — fas 1
        // (annonsering, bara om den inte redan körts: AnnonseradUtc == null)
        // eller fas 2 (lansering, precis som innan Del 3 fanns). Utan
        // annonsering (AnnonseringUtc == null) är det bara fas 2 som
        // någonsin blir due — oförändrat beteende från Del 1/2.
        var due = await db.Uppdateringar
            .Where(u =>
                (u.AnnonseringUtc != null && u.AnnonseringUtc <= now && u.AnnonseradUtc == null)
                || (u.SchemalagdPubliceringUtc != null && u.SchemalagdPubliceringUtc <= now))
            .ToListAsync(ct);

        foreach (var uppdatering in due)
        {
            var punkter = await db.UppdateringsPunkter.Where(p => p.UppdateringId == uppdatering.Id).ToListAsync(ct);
            var harPunkter = punkter.Count > 0;
            var målgrupp = punkter.Any(p => p.Synlighet == UppdateringsVärden.SynlighetAlla) ? "Alla" : "Användare";

            var annonseringDue = uppdatering.AnnonseringUtc != null && uppdatering.AnnonseringUtc <= now && uppdatering.AnnonseradUtc == null;
            var lanseringDue = uppdatering.SchemalagdPubliceringUtc != null && uppdatering.SchemalagdPubliceringUtc <= now;

            // Fas 1: annonsering i förväg (Beslut 2026-10-08). Publicerar
            // posten (den visas som en "Kommer snart"-teaser, se
            // UppdateringarController.MedAnnonseringsteaser) utan att
            // aktivera flaggor än — det sker först vid fas 2.
            if (annonseringDue)
            {
                if (harPunkter && !uppdatering.Publicerad)
                {
                    uppdatering.Publicerad = true;
                    await aktivitetslogg.LogAsync(
                        AktörTyper.System, LoggTyper.Konfiguration,
                        $"Uppdatering annonserad automatiskt — {uppdatering.Titel}", "Annonseringstidpunkt nådd");
                }

                if (harPunkter && uppdatering.SkickaPush && push != null
                    && (uppdatering.PushSkickaVid == "Annonsering" || uppdatering.PushSkickaVid == "Båda"))
                {
                    var titel = $"Kommer {SvenskDatum.FormateraDag(uppdatering.SchemalagdPubliceringUtc!.Value)}";
                    var meddelande = uppdatering.PushMeddelande ?? uppdatering.Titel;
                    var mottagare = await PushDispatcher.DispatchNewVersionAsync(
                        db, push, frontendUrl, uppdatering.PushVersion ?? "", meddelande, ct, customTitle: titel);
                    await aktivitetslogg.LogAsync(
                        AktörTyper.System, LoggTyper.Push,
                        $"Push skickad automatiskt — {titel}", $"{mottagare} mottagare ({uppdatering.Titel})");
                }

                if (harPunkter && uppdatering.VisaBanderoll)
                {
                    db.MaintenanceBanners.Add(new MaintenanceBanner
                    {
                        Id = Guid.NewGuid(),
                        Message = uppdatering.Titel,
                        Rubrik = $"Kommer {SvenskDatum.FormateraDag(uppdatering.SchemalagdPubliceringUtc!.Value)}",
                        Stil = "Kommande",
                        LankUrl = "/uppdateringar",
                        Audience = målgrupp,
                        StartUtc = now,
                        EndUtc = uppdatering.SchemalagdPubliceringUtc!.Value, // slutar exakt vid lansering
                        CreatedAt = now,
                    });
                    await aktivitetslogg.LogAsync(
                        AktörTyper.System, LoggTyper.Konfiguration,
                        $"Banderoll skapad automatiskt — {uppdatering.Titel}", $"Kommande, målgrupp: {målgrupp}");
                }

                uppdatering.AnnonseradUtc = now;
                uppdatering.UpdatedAt = now;
            }

            // Fas 2: lansering — oförändrad logik från Del 1/2, oavsett om
            // fas 1 körts (med annonsering) eller inte (utan).
            if (lanseringDue)
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
                if (harPunkter && !uppdatering.Publicerad)
                {
                    uppdatering.Publicerad = true;
                    await aktivitetslogg.LogAsync(
                        AktörTyper.System, LoggTyper.Konfiguration,
                        $"Uppdatering publicerad automatiskt — {uppdatering.Titel}", "Schemalagd publicering nådd");
                }

                if (harPunkter && uppdatering.SkickaPush && push != null
                    && (uppdatering.PushSkickaVid == "Lansering" || uppdatering.PushSkickaVid == "Båda"))
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
                    db.MaintenanceBanners.Add(new MaintenanceBanner
                    {
                        Id = Guid.NewGuid(),
                        Message = uppdatering.Titel,
                        Rubrik = "Nytt på Samhällsinformation",
                        Stil = "Nyhet",
                        LankUrl = "/uppdateringar",
                        Audience = målgrupp,
                        StartUtc = now,
                        EndUtc = now.AddDays(BannerLängdDagar),
                        CreatedAt = now,
                    });
                    await aktivitetslogg.LogAsync(
                        AktörTyper.System, LoggTyper.Konfiguration,
                        $"Banderoll skapad automatiskt — {uppdatering.Titel}", $"Målgrupp: {målgrupp}");
                }

                // Nollställer ALLT schema-relaterat — en post som redan
                // bearbetats ska inte visa kvarvarande flaggor/annonsering
                // som om de fortfarande väntade (upptäckt i code review för
                // Del 1: tidigare nollställdes bara tidsstämpeln, vilket
                // lämnade en missvisande flagg-lista kvar i GET-svaret).
                uppdatering.SchemalagdPubliceringUtc = null;
                uppdatering.SchemalagdaFlaggorJson = null;
                uppdatering.AnnonseringUtc = null;
                uppdatering.AnnonseradUtc = null;
                uppdatering.UpdatedAt = now;
            }
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
