namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Bevakningar (FAS 4-uppföljning) — ersätter det gamla UserPolisenFilter
// (en rad, en AND-kombination) med flera oberoende regler per användare,
// ELLER-kombinerade i PolisenBevakningMatcher. Bara Polisen har det här,
// se PolisenBevakning för varför.
[ApiController]
[Route("api/user/polisen-bevakningar")]
[Authorize]
public class UserPolisenBevakningController : ControllerBase
{
    public const int MaxBevakningar = 10;

    private readonly AppDbContext _db;

    public UserPolisenBevakningController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var bevakningar = await _db.PolisenBevakningar
            .Where(b => b.UserId == CurrentUserId)
            .OrderBy(b => b.CreatedAt)
            .ToListAsync();

        return Ok(bevakningar.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BevakningRequest req)
    {
        var userId = CurrentUserId;
        var antal = await _db.PolisenBevakningar.CountAsync(b => b.UserId == userId);
        if (antal >= MaxBevakningar)
            return BadRequest($"Max {MaxBevakningar} bevakningar per användare.");

        var bevakning = new PolisenBevakning
        {
            UserId         = userId,
            KategorierJson = req.Kategorier == null ? null : JsonSerializer.Serialize(req.Kategorier),
            OmradenJson    = req.Omraden    == null ? null : JsonSerializer.Serialize(req.Omraden),
        };
        _db.PolisenBevakningar.Add(bevakning);
        await _db.SaveChangesAsync();

        return Ok(ToDto(bevakning));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BevakningRequest req)
    {
        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == id && b.UserId == CurrentUserId);
        if (bevakning == null) return NotFound();

        bevakning.KategorierJson = req.Kategorier == null ? null : JsonSerializer.Serialize(req.Kategorier);
        bevakning.OmradenJson    = req.Omraden    == null ? null : JsonSerializer.Serialize(req.Omraden);
        await _db.SaveChangesAsync();

        return Ok(ToDto(bevakning));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == id && b.UserId == CurrentUserId);
        if (bevakning == null) return NotFound();

        _db.PolisenBevakningar.Remove(bevakning);
        await _db.SaveChangesAsync();

        return Ok();
    }

    private static BevakningResponse ToDto(PolisenBevakning b) => new(
        Id:         b.Id,
        Kategorier: b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson),
        Omraden:    b.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson)
    );
}

public record BevakningRequest(List<string>? Kategorier, List<string>? Omraden);
public record BevakningResponse(Guid Id, List<string>? Kategorier, List<string>? Omraden);
