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
                sourceId  = p.SourceId,
                shortName = p.Source.ShortName,
                isActive  = p.IsActive,
                sortOrder = p.SortOrder,
            })
            .ToListAsync();

        return Ok(prefs);
    }

    [HttpPut]
    public async Task<IActionResult> SaveSources([FromBody] List<SourcePrefRequest> items)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var existing = await _db.UserSourcePreferences
            .Where(p => p.UserId == userId)
            .ToListAsync();

        var oldSnapshot = existing.ToDictionary(p => p.SourceId, p => new { p.IsActive, p.SortOrder });

        foreach (var item in items)
        {
            var pref = existing.FirstOrDefault(p => p.SourceId == item.SourceId);
            if (pref == null)
            {
                _db.UserSourcePreferences.Add(new UserSourcePreference
                {
                    UserId    = userId,
                    SourceId  = item.SourceId,
                    IsActive  = item.IsActive,
                    SortOrder = item.SortOrder,
                });
            }
            else
            {
                pref.IsActive  = item.IsActive;
                pref.SortOrder = item.SortOrder;
            }
        }

        foreach (var item in items)
        {
            if (!oldSnapshot.TryGetValue(item.SourceId, out var old)) continue;
            if (old.IsActive != item.IsActive)
                _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
                {
                    UserId   = userId,
                    Setting  = $"source.{item.SourceId}.isActive",
                    OldValue = old.IsActive.ToString(),
                    NewValue = item.IsActive.ToString(),
                });
            if (old.SortOrder != item.SortOrder)
                _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
                {
                    UserId   = userId,
                    Setting  = $"source.{item.SourceId}.sortOrder",
                    OldValue = old.SortOrder.ToString(),
                    NewValue = item.SortOrder.ToString(),
                });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record SourcePrefRequest(int SourceId, bool IsActive, int SortOrder);
