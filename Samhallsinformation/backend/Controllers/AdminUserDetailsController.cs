namespace Samhallsinformation.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Läsvyer (och, för Sparat, skrivvyer) på en enskild användares konto, till
// Anvandare.tsx-detaljpanelen. Egen controller (inte AdminUsersController,
// som är Admin-only) eftersom Anvandare-sidan är Support-åtkomlig i UI:t
// (AdminPage.SUPPORT_SEKTIONER) — ett klassattribut kan inte "luckras upp"
// på metodnivå i ASP.NET Core, attributen är kumulativa (AND), inte en
// override.
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin,Support")]
public class AdminUserDetailsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminUserDetailsController(AppDbContext db) => _db = db;

    // Admin-variant av GET /api/user/polisen-bevakningar (UserPolisenBevakningController).
    [HttpGet("{id}/polisen-bevakningar")]
    public async Task<IActionResult> GetPolisenBevakningar(Guid id)
    {
        var bevakningar = await _db.PolisenBevakningar
            .Where(b => b.UserId == id)
            .OrderBy(b => b.CreatedAt)
            .ToListAsync();

        return Ok(bevakningar.Select(BevakningTillDto));
    }

    // Admin/support-initierad skrivrätt på en användares bevakningar — löser
    // att man annars måste slå på kallor_polisen_filter GLOBALT (exponerar
    // funktionen för alla riktiga användare) bara för att kunna hjälpa en
    // enskild användare rätta sina inställningar. Speglar
    // UserPolisenBevakningController exakt, fast skopat mot {id} istället för
    // CurrentUserId, och ChangedBy="admin" i stället för "user" i loggen.
    [HttpPost("{id}/polisen-bevakningar")]
    [RequestSizeLimit(UserPolisenBevakningController.MaxRequestBytes)]
    public async Task<IActionResult> CreatePolisenBevakning(Guid id, [FromBody] BevakningRequest req)
    {
        var validering = PolisenBevakningValidator.Validera(req.Kategorier, req.Omraden);
        if (!validering.Ok) return BadRequest(validering.Fel);

        var antal = await _db.PolisenBevakningar.CountAsync(b => b.UserId == id);
        if (antal >= UserPolisenBevakningController.MaxBevakningar)
            return BadRequest($"Max {UserPolisenBevakningController.MaxBevakningar} bevakningar per användare.");

        var bevakning = new PolisenBevakning
        {
            UserId         = id,
            KategorierJson = validering.Kategorier == null ? null : JsonSerializer.Serialize(validering.Kategorier),
            OmradenJson    = validering.Omraden    == null ? null : JsonSerializer.Serialize(validering.Omraden),
        };
        _db.PolisenBevakningar.Add(bevakning);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = id, Setting = "polisen_bevakning_skapad", OldValue = null,
            NewValue = $"{validering.Kategorier?.Count ?? 0} kategorier, {validering.Omraden?.Count ?? 0} områden", ChangedBy = "admin",
        });
        await _db.SaveChangesAsync();

        return Ok(BevakningTillDto(bevakning));
    }

    [HttpPut("{id}/polisen-bevakningar/{bevakningId}")]
    [RequestSizeLimit(UserPolisenBevakningController.MaxRequestBytes)]
    public async Task<IActionResult> UpdatePolisenBevakning(Guid id, Guid bevakningId, [FromBody] BevakningRequest req)
    {
        var validering = PolisenBevakningValidator.Validera(req.Kategorier, req.Omraden);
        if (!validering.Ok) return BadRequest(validering.Fel);

        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == bevakningId && b.UserId == id);
        if (bevakning == null) return NotFound();

        var gammaltVärde = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}";
        bevakning.KategorierJson = validering.Kategorier == null ? null : JsonSerializer.Serialize(validering.Kategorier);
        bevakning.OmradenJson    = validering.Omraden    == null ? null : JsonSerializer.Serialize(validering.Omraden);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = id, Setting = "polisen_bevakning_ändrad",
            OldValue = gammaltVärde, NewValue = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}",
            ChangedBy = "admin",
        });
        await _db.SaveChangesAsync();

        return Ok(BevakningTillDto(bevakning));
    }

    [HttpDelete("{id}/polisen-bevakningar/{bevakningId}")]
    public async Task<IActionResult> DeletePolisenBevakning(Guid id, Guid bevakningId)
    {
        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == bevakningId && b.UserId == id);
        if (bevakning == null) return NotFound();

        _db.PolisenBevakningar.Remove(bevakning);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = id, Setting = "polisen_bevakning_borttagen",
            OldValue = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}", NewValue = null,
            ChangedBy = "admin",
        });
        await _db.SaveChangesAsync();

        return Ok();
    }

    private static object BevakningTillDto(PolisenBevakning b) => new
    {
        b.Id,
        Kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson),
        Omraden    = b.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson),
    };

    // Admin/support-variant av GET/PUT /api/user/sources (UserSourcesController)
    // — samma "hjälp en användare rätta sina inställningar utan att slå på en
    // flagga globalt"-motivering som bevakningarna ovan. En enskild
    // toggle-endpoint (inte en full bulk-PUT) — admin ändrar bara
    // aktiv/inaktiv, rör aldrig sortOrder (rent kosmetiskt, användarens eget
    // drag-och-släpp).
    [HttpGet("{id}/sources")]
    public async Task<IActionResult> GetUserSources(Guid id)
    {
        var prefs = await _db.UserSourcePreferences
            .Where(p => p.UserId == id)
            .Include(p => p.Source)
            .OrderBy(p => p.SortOrder)
            .Select(p => new
            {
                sourceId  = p.SourceId,
                shortName = p.Source.ShortName,
                name      = p.Source.Name,
                isActive  = p.IsActive,
            })
            .ToListAsync();

        return Ok(prefs);
    }

    [HttpPut("{id}/sources/{sourceId:int}")]
    public async Task<IActionResult> SetUserSourceActive(Guid id, int sourceId, [FromBody] SetSourceActiveRequest req)
    {
        var pref = await _db.UserSourcePreferences.FirstOrDefaultAsync(p => p.UserId == id && p.SourceId == sourceId);
        var gammaltVärde = pref?.IsActive.ToString() ?? "false";
        if (pref == null)
        {
            var nästaOrder = await _db.UserSourcePreferences.Where(p => p.UserId == id).CountAsync();
            pref = new UserSourcePreference { UserId = id, SourceId = sourceId, IsActive = req.IsActive, SortOrder = nästaOrder };
            _db.UserSourcePreferences.Add(pref);
        }
        else
        {
            pref.IsActive = req.IsActive;
        }

        if (gammaltVärde != req.IsActive.ToString())
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
            {
                UserId = id, Setting = $"source.{sourceId}.isActive",
                OldValue = gammaltVärde, NewValue = req.IsActive.ToString(), ChangedBy = "admin",
            });

        await _db.SaveChangesAsync();
        return Ok();
    }

    // Inställningshistorik för en enskild användare — UserSettingAuditLog har
    // funnits sedan session 18 (lösenord/e-post/namn/Mina källor loggar redan
    // dit) men saknade en admin-vy helt. Till skillnad från den delade
    // Aktivitetsloggen (AdminActivityLog) är det här per-användare-diagnostik
    // för felsökning ("varför funkade inte X"), inte menat att synas i
    // Senaste händelser.
    [HttpGet("{id}/setting-log")]
    public async Task<IActionResult> GetSettingLog(Guid id)
    {
        var rader = await _db.UserSettingAuditLogs
            .Where(l => l.UserId == id)
            .OrderByDescending(l => l.ChangedAt)
            .Take(100)
            .Select(l => new { l.Setting, l.OldValue, l.NewValue, l.ChangedBy, l.ChangedAt })
            .ToListAsync();

        return Ok(rader);
    }

    // Notishistorik för en enskild användare — samma NotificationDeliveryLog-
    // tabell som redan används aggregerat i StatsController.
    [HttpGet("{id}/notification-log")]
    public async Task<IActionResult> GetNotificationLog(Guid id)
    {
        var log = await (
            from l in _db.NotificationDeliveryLogs
            where l.UserId == id
            join src in _db.Sources on l.SourceId equals src.Id into srcJ
            from src in srcJ.DefaultIfEmpty()
            orderby l.SentAt descending
            select new
            {
                l.SentAt,
                l.Channel,
                SourceName = src != null ? src.ShortName : null,
                l.Subject,
                l.Recipient,
                l.Status,
                l.ErrorMessage,
            }
        ).Take(50).ToListAsync();

        return Ok(log);
    }

    // Läsläge på en användares push-inställningar — fanns tidigare ingenstans
    // i admin, upptäckt 2026-09-12 när en riktig produktionsanvändare
    // felsökte varför push uteblev och admin inte kunde se något alls.
    // Bara läs — att ÄNDRA en användares inställningar åt dem är inte
    // efterfrågat, det är fortfarande deras eget val i Konto → Push-notiser.
    // Endpoint/P256dh/Auth (UserDevice) exponeras avsiktligt inte — de är
    // känsliga push-prenumerationsuppgifter utan diagnostiskt värde här.
    [HttpGet("{id}/push-settings")]
    public async Task<IActionResult> GetPushSettings(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        var enheter = await _db.UserDevices
            .Where(d => d.UserId == id)
            .OrderByDescending(d => d.LastSeenAt)
            .Select(d => new { d.Id, d.DeviceName, d.Platform, d.RegisteredAt, d.LastSeenAt })
            .ToListAsync();

        return Ok(new
        {
            user.PushEnabled,
            user.PushNyaHandelser,
            user.PushNyVersion,
            Enheter = enheter,
        });
    }

    // Skrivrätt tillagd 2026-09-13 — bara läge räckte inte i praktiken:
    // en användare hör ofta av sig till supporten och BER om att en
    // inställning ändras (t.ex. "jag får inga notiser, kan ni slå på det
    // igen?"), och supporten hade inget sätt att göra det åt dem. Samma
    // PATCH-semantik (nullable fält, bara satta värden skrivs) som
    // självbetjänings-varianten (PushController.SaveSettings), som redan
    // definierar PushSettingsRequest. Policy, inte teknik: ska bara
    // användas när ANVÄNDAREN SJÄLV bett om ändringen — se Rutiner.
    [HttpPut("{id}/push-settings")]
    public async Task<IActionResult> SetPushSettings(Guid id, [FromBody] PushSettingsRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        void Logga(string setting, bool gammalt, bool? nytt)
        {
            if (!nytt.HasValue || nytt.Value == gammalt) return;
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
            {
                UserId = id, Setting = setting,
                OldValue = gammalt.ToString(), NewValue = nytt.Value.ToString(), ChangedBy = "admin",
            });
        }

        Logga("push_enabled",        user.PushEnabled,      req.PushEnabled);
        Logga("push_nya_handelser",  user.PushNyaHandelser, req.PushNyaHandelser);
        Logga("push_ny_version",     user.PushNyVersion,    req.PushNyVersion);

        if (req.PushEnabled.HasValue)      user.PushEnabled      = req.PushEnabled.Value;
        if (req.PushNyaHandelser.HasValue) user.PushNyaHandelser = req.PushNyaHandelser.Value;
        if (req.PushNyVersion.HasValue)    user.PushNyVersion    = req.PushNyVersion.Value;

        await _db.SaveChangesAsync();
        return Ok();
    }

    // Admin/support-variant av GET /api/user/saved-events
    // (UserSavedEventsController) — samma tabell, men för valfri användare
    // istället för den inloggade. Returnerar händelsedetaljer (inte bara
    // ID:n) eftersom admin/support inte har användarens egen feed laddad
    // att slå upp titel/källa mot.
    [HttpGet("{id}/saved-events")]
    public async Task<IActionResult> GetSavedEvents(Guid id)
    {
        var events = await (
            from s in _db.UserSavedEvents
            where s.UserId == id
            join e in _db.Events on s.EventId equals e.Id
            join src in _db.Sources on e.SourceId equals src.Id into srcJ
            from src in srcJ.DefaultIfEmpty()
            orderby s.SavedAt descending
            select new
            {
                EventId     = s.EventId,
                Title       = e.Title,
                Url         = e.Url,
                SourceName  = src != null ? src.ShortName : "Okänd källa",
                PublishedAt = e.PublishedAt,
                SavedAt     = s.SavedAt,
            }
        ).ToListAsync();

        return Ok(events);
    }

    // Sparar en händelse till en annan användares konto — används av
    // Händelsesöks "Spara till användare" (admin/support hjälper en
    // användare att hitta något igen). Samma unikhetsskydd (UserId, EventId)
    // som self-service-vägen.
    [HttpPost("{id}/saved-events")]
    public async Task<IActionResult> SaveEvent(Guid id, [FromBody] AdminSaveEventRequest req)
    {
        var exists = await _db.UserSavedEvents.AnyAsync(s => s.UserId == id && s.EventId == req.EventId);
        if (!exists)
        {
            _db.UserSavedEvents.Add(new UserSavedEvent { UserId = id, EventId = req.EventId });
            await _db.SaveChangesAsync();
        }
        return Ok();
    }

    [HttpDelete("{id}/saved-events/{eventId}")]
    public async Task<IActionResult> UnsaveEvent(Guid id, Guid eventId)
    {
        var existing = await _db.UserSavedEvents.FirstOrDefaultAsync(s => s.UserId == id && s.EventId == eventId);
        if (existing != null)
        {
            _db.UserSavedEvents.Remove(existing);
            await _db.SaveChangesAsync();
        }
        return Ok();
    }

    // Förklarar för admin/support VARFÖR (eller varför inte) en given
    // händelse syns i en given användares Mitt flöde — samma fråga en
    // supportagent annars måste lista ut manuellt (öppna Mina källor +
    // bevakningarna och räkna ut det för hand). Läser bara, ändrar inget.
    // Tre nivåer, samma prioritetsordning som NewsFeed.tsx (mittEvents):
    // (1) källan inte aktiv → visas inte alls, (2) icke-Polisen-källa aktiv
    // → visas alltid, (3) Polisen → PolisenBevakningMatcher.Explain avgör.
    [HttpGet("{id}/explain-event/{eventId}")]
    public async Task<IActionResult> ExplainEvent(Guid id, Guid eventId)
    {
        var ev = await _db.Events.FirstOrDefaultAsync(e => e.Id == eventId);
        if (ev == null) return NotFound("Händelsen hittades inte.");

        var pref = await _db.UserSourcePreferences
            .Include(p => p.Source)
            .FirstOrDefaultAsync(p => p.UserId == id && p.SourceId == ev.SourceId);

        var sourceName = pref?.Source?.ShortName
            ?? (await _db.Sources.Where(s => s.Id == ev.SourceId).Select(s => s.ShortName).FirstOrDefaultAsync())
            ?? "okänd källa";

        if (pref == null || !pref.IsActive)
            return Ok(new { visasIMittFlode = false, anledning = $"Prenumererar inte på {sourceName}." });

        if (sourceName != "Polisen")
            return Ok(new { visasIMittFlode = true, anledning = $"Prenumererar på {sourceName} — inget ytterligare filter för den källan." });

        var bevakningar = await _db.PolisenBevakningar.Where(b => b.UserId == id).ToListAsync();
        var (matchar, anledning, _) = PolisenBevakningMatcher.Explain(ev, bevakningar);

        return Ok(new { visasIMittFlode = matchar, anledning });
    }

    // Omvänd uppslagning: för en lista händelse-ID:n, vilka användare har
    // redan sparat respektive händelse? Används av Händelsesöks
    // "📌 Sparad till ..."-badge under sökresultaten (skopas till händelserna
    // på aktuell sida, inte hela tabellen).
    [HttpGet("/api/admin/saved-events/by-event")]
    public async Task<IActionResult> GetSavedEventsByEvent([FromQuery] List<Guid> eventIds)
    {
        if (eventIds.Count == 0) return Ok(new Dictionary<Guid, object>());

        var rows = await (
            from s in _db.UserSavedEvents
            where eventIds.Contains(s.EventId)
            join u in _db.Users on s.UserId equals u.Id
            select new { s.EventId, u.Id, u.Name, u.Email }
        ).ToListAsync();

        var grouped = rows
            .GroupBy(r => r.EventId)
            .ToDictionary(g => g.Key, g => g.Select(r => new { r.Id, r.Name, r.Email }).ToList());

        return Ok(grouped);
    }
}

public record AdminSaveEventRequest(Guid EventId);
public record SetSourceActiveRequest(bool IsActive);
