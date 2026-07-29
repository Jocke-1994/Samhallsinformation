namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// "Sparat" (session 24) — bokmärk enskilda händelser oavsett källa.
[ApiController]
[Route("api/user/saved-events")]
[Authorize]
public class UserSavedEventsController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserSavedEventsController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var ids = await _db.UserSavedEvents
            .Where(s => s.UserId == CurrentUserId)
            .OrderByDescending(s => s.SavedAt)
            .Select(s => s.EventId)
            .ToListAsync();

        return Ok(ids);
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveEventRequest req)
    {
        var userId = CurrentUserId;
        var exists = await _db.UserSavedEvents.AnyAsync(s => s.UserId == userId && s.EventId == req.EventId);
        if (!exists)
        {
            _db.UserSavedEvents.Add(new UserSavedEvent { UserId = userId, EventId = req.EventId });
            await _db.SaveChangesAsync();
        }
        return Ok();
    }

    [HttpDelete("{eventId}")]
    public async Task<IActionResult> Unsave(Guid eventId)
    {
        var userId = CurrentUserId;
        var existing = await _db.UserSavedEvents.FirstOrDefaultAsync(s => s.UserId == userId && s.EventId == eventId);
        if (existing != null)
        {
            _db.UserSavedEvents.Remove(existing);
            await _db.SaveChangesAsync();
        }
        return Ok();
    }
}

public record SaveEventRequest(Guid EventId);
