namespace Samhallsinformation.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

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

    // Admin-variant av GET /api/user/polisen-bevakningar (UserPolisenBevakningController),
    // read-only här — admin/support visar bevakningarna, ändrar dem inte åt användaren.
    [HttpGet("{id}/polisen-bevakningar")]
    public async Task<IActionResult> GetPolisenBevakningar(Guid id)
    {
        var bevakningar = await _db.PolisenBevakningar
            .Where(b => b.UserId == id)
            .OrderBy(b => b.CreatedAt)
            .ToListAsync();

        return Ok(bevakningar.Select(b => new
        {
            b.Id,
            Kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson),
            Omraden    = b.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson),
        }));
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
