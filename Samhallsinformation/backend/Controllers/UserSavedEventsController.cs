namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Events;
using Samhallsinformation.Application.Feed;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// "Sparat" (session 24) — bokmärk enskilda händelser oavsett källa.
[ApiController]
[Route("api/user/saved-events")]
[Authorize]
public class UserSavedEventsController : ControllerBase
{
    private readonly AppDbContext _db;

    private readonly IUserFeedService _feed;

    public UserSavedEventsController(AppDbContext db, IUserFeedService feed)
    {
        _db = db;
        _feed = feed;
    }

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

    // Själva händelserna (inte bara id:n), paginerat - så en sparad händelse syns
    // i Sparat oavsett hur gammal den är (V3-11). GET / ovan är oförändrad och
    // används fortsatt för bokmärkesikonerna.
    [HttpGet("events")]
    public async Task<IActionResult> GetEvents([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var sida = await _feed.GetSparatAsync(CurrentUserId, page, pageSize, ct);
        return Ok(new { total = sida.Total, page = sida.Page, pageSize = sida.PageSize, events = sida.Events.Select(EventDto.From), hasMore = sida.HasMore, totalExakt = sida.TotalExakt });
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
