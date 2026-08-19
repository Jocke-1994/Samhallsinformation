namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// POST är öppen för Admin+Support (klassattributet) eftersom kontoåtgärder
// (Sparat: tillagd/borttagen) triggas från Användarhantering/Händelsesök,
// som båda är Support-åtkomliga sidor. GET/undo smalnas ytterligare av till
// Admin-only per metod — [Authorize]-attribut ANDas, så en metod kan göra
// klassens tillåtna roller striktare (men aldrig bredare, se
// AdminUserDetailsController-mönstret).
[ApiController]
[Route("api/admin/activity-log")]
[Authorize(Roles = "Admin,Support")]
public class AdminActivityLogController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminActivityLogController(AppDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetLog()
    {
        var rader = await _db.AdminActivityLogs.OrderByDescending(l => l.Tid).ToListAsync();
        return Ok(rader.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> CreateLogEntry([FromBody] CreateActivityLogRequest req)
    {
        // Namnet hämtas ur JWT:n (riktig identitet) — tidigare låg det som en
        // hårdkodad mock-konstant ("Joakim Rehn") oavsett vem som faktiskt var
        // inloggad. AktivVy (Admin/Support/Användare-vyn admin/support just då
        // tittar som) är fortfarande klientens eget val, inte JWT:ns roll —
        // rollväljaren låter en Admin bläddra "som" en lägre roll.
        var namn = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Okänd";

        var post = new AdminActivityLog
        {
            Vem    = $"{namn} ({req.AktivVy}-läge)",
            Typ    = req.Typ,
            Rubrik = req.Rubrik,
            Detalj = req.Detalj,

            AngraAnvandareId = req.ÅngraData?.AnvandareId,
            AngraEventId     = req.ÅngraData?.Handelse.EventId,
            AngraTitle       = req.ÅngraData?.Handelse.Title,
            AngraSourceName  = req.ÅngraData?.Handelse.SourceName,
            AngraPublishedAt = req.ÅngraData?.Handelse.PublishedAt,
            AngraSparadDatum = req.ÅngraData?.Handelse.SparadDatum,
            AngraUndoAction  = req.ÅngraData?.UndoAction,
        };

        _db.AdminActivityLogs.Add(post);
        await _db.SaveChangesAsync();
        return Ok(ToDto(post));
    }

    [HttpPut("{id:guid}/undo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkUndone(Guid id)
    {
        var post = await _db.AdminActivityLogs.FindAsync(id);
        if (post == null) return NotFound();

        post.Ångrad = true;
        await _db.SaveChangesAsync();
        return Ok(ToDto(post));
    }

    private static LoggPostDto ToDto(AdminActivityLog p) => new(
        p.Id, p.Tid, p.Vem, p.Typ, p.Rubrik, p.Detalj, p.Ångrad,
        p.AngraAnvandareId == null ? null : new ÅngraDataDto(
            p.AngraAnvandareId,
            new SparadHandelseMiniDto(p.AngraEventId!, p.AngraTitle!, p.AngraSourceName!, p.AngraPublishedAt!, p.AngraSparadDatum!),
            p.AngraUndoAction!
        )
    );
}

public record CreateActivityLogRequest(string Typ, string Rubrik, string Detalj, string AktivVy, ÅngraDataRequest? ÅngraData);
public record ÅngraDataRequest(string AnvandareId, SparadHandelseMiniRequest Handelse, string UndoAction);
public record SparadHandelseMiniRequest(string EventId, string Title, string SourceName, string PublishedAt, string SparadDatum);

public record LoggPostDto(Guid Id, DateTime Tid, string Vem, string Typ, string Rubrik, string Detalj, bool Ångrad, ÅngraDataDto? ÅngraData);
public record ÅngraDataDto(string AnvandareId, SparadHandelseMiniDto Handelse, string UndoAction);
public record SparadHandelseMiniDto(string EventId, string Title, string SourceName, string PublishedAt, string SparadDatum);
