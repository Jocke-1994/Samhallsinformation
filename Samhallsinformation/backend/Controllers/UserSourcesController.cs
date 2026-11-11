namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/user/sources")]
[Authorize]
public class UserSourcesController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserSourcesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetSources()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var prefs = await _db.UserSourcePreferences
            .Where(p => p.UserId == userId)
            .Include(p => p.Source)
            .OrderBy(p => p.SortOrder)
            .Select(p => new
            {
                sourceId = p.SourceId,
                shortName = p.Source.ShortName,
                isActive = p.IsActive,
                sortOrder = p.SortOrder,
            })
            .ToListAsync();

        return Ok(prefs);
    }

    [HttpPut]
    public async Task<IActionResult> SaveSources([FromBody] List<SourcePrefRequest> items)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Samma SourceId två gånger i body ger annars dubbel Add -> unikt index (UserId, SourceId) -> 500.
        // Sista posten vinner (samma semantik som om klienten skickat dem som två efterföljande PUT).
        items = items
            .GroupBy(i => i.SourceId)
            .Select(g => g.Last())
            .ToList();

        var allSources = await _db.Sources.ToListAsync();
        var sourceById = allSources.ToDictionary(s => s.Id);

        // V4-6: källor som delar ShortName (multi-feed-mönstret, t.ex. Polisen +
        // Polisen Efterlysningar, SMHI + SMHI Nyheter) visas som EN rad i
        // Aktiva/Alla källor (frontend grupperar på ShortName) — en ändring på
        // bara den ena skulle osynkronisera gruppen från det användaren faktiskt
        // ser. Expandera varje begärd ändring till hela ShortName-gruppen:
        // avaktivering gäller alltid alla syskon, aktivering bara publicerade
        // syskon (en opublicerad syskonkälla ska aldrig kunna blockera att
        // huvudkällan går att aktivera — se publiceringsvalideringen nedan).
        var siblingsByShortName = allSources
            .GroupBy(s => s.ShortName)
            .ToDictionary(g => g.Key, g => g.Select(s => s.Id).ToList());

        var expanded = items.ToDictionary(i => i.SourceId);
        foreach (var item in items)
        {
            if (!sourceById.TryGetValue(item.SourceId, out var src)) continue;
            foreach (var siblingId in siblingsByShortName.GetValueOrDefault(src.ShortName, []))
            {
                if (siblingId == item.SourceId || expanded.ContainsKey(siblingId)) continue;
                if (item.IsActive && !sourceById[siblingId].IsPublished) continue;
                expanded[siblingId] = item with { SourceId = siblingId };
            }
        }
        items = expanded.Values.ToList();

        var existing = await _db.UserSourcePreferences
            .Where(p => p.UserId == userId)
            .ToListAsync();

        // Validera mot Sources innan något skrivs (atomärt: ett ogiltigt id avvisar hela anropet).
        // Publiceringsregeln är densamma som i SourcesController/EventsController: Source.IsPublished.
        var requestedIds = items.Select(i => i.SourceId).ToList();
        var publishedById = sourceById
            .Where(kv => requestedIds.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value.IsPublished);

        foreach (var item in items)
        {
            if (!publishedById.TryGetValue(item.SourceId, out var isPublished))
                return BadRequest($"Okänd källa: {item.SourceId}.");

            if (isPublished) continue;

            // Opublicerad (sandlådekälla, eller avpublicerad efter att användaren prenumererade).
            // Ny prenumeration och återaktivering avvisas; en redan sparad rad får ligga kvar,
            // avaktiveras och sorteras om så att användaren aldrig fastnar i att inte kunna spara sin lista.
            var pref = existing.FirstOrDefault(p => p.SourceId == item.SourceId);
            var blirAktiv = item.IsActive && (pref == null || !pref.IsActive);
            if (pref == null || blirAktiv)
                return BadRequest($"Källa {item.SourceId} är inte publicerad och kan inte prenumereras på.");
        }

        var oldSnapshot = existing.ToDictionary(p => p.SourceId, p => new { p.IsActive, p.SortOrder });

        foreach (var item in items)
        {
            var pref = existing.FirstOrDefault(p => p.SourceId == item.SourceId);
            if (pref == null)
            {
                _db.UserSourcePreferences.Add(new UserSourcePreference
                {
                    UserId = userId,
                    SourceId = item.SourceId,
                    IsActive = item.IsActive,
                    SortOrder = item.SortOrder,
                });
            }
            else
            {
                pref.IsActive = item.IsActive;
                pref.SortOrder = item.SortOrder;
            }
        }

        foreach (var item in items)
        {
            if (!oldSnapshot.TryGetValue(item.SourceId, out var old)) continue;
            if (old.IsActive != item.IsActive)
                _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
                {
                    UserId = userId,
                    Setting = $"source.{item.SourceId}.isActive",
                    OldValue = old.IsActive.ToString(),
                    NewValue = item.IsActive.ToString(),
                });
            if (old.SortOrder != item.SortOrder)
                _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
                {
                    UserId = userId,
                    Setting = $"source.{item.SourceId}.sortOrder",
                    OldValue = old.SortOrder.ToString(),
                    NewValue = item.SortOrder.ToString(),
                });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record SourcePrefRequest(int SourceId, bool IsActive, int SortOrder);
