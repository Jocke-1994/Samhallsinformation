namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Bevakningar (FAS 4-uppföljning) — ersätter det gamla UserPolisenFilter
// (en rad, en AND-kombination) med flera oberoende regler per användare,
// ELLER-kombinerade i PolisenBevakningMatcher. Bara Polisen har det här,
// se PolisenBevakning för varför.
[ApiController]
[Route("api/user/polisen-bevakningar")]
[Authorize]
public class UserPolisenBevakningController : ControllerBase
{
    public const int MaxBevakningar = 5;
    public const int MaxRequestBytes = 64 * 1024;

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

    // Kroppsgräns (V3-17): en giltig request är några KB (högst 290 kommuner +
    // 16 kategorier); allt över 64 KB avvisas med 413 innan JSON:en parsas.
    [HttpPost]
    [RequestSizeLimit(MaxRequestBytes)]
    public async Task<IActionResult> Create([FromBody] BevakningRequest req)
    {
        var validering = PolisenBevakningValidator.Validera(req.Kategorier, req.Omraden);
        if (!validering.Ok) return BadRequest(validering.Fel);

        var userId = CurrentUserId;
        var antal = await _db.PolisenBevakningar.CountAsync(b => b.UserId == userId);
        if (antal >= MaxBevakningar)
            return BadRequest($"Max {MaxBevakningar} bevakningar per användare.");

        var bevakning = new PolisenBevakning
        {
            UserId = userId,
            KategorierJson = validering.Kategorier == null ? null : JsonSerializer.Serialize(validering.Kategorier),
            OmradenJson = validering.Omraden == null ? null : JsonSerializer.Serialize(validering.Omraden),
        };
        _db.PolisenBevakningar.Add(bevakning);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = userId,
            Setting = "polisen_bevakning_skapad",
            OldValue = null,
            NewValue = $"{validering.Kategorier?.Count ?? 0} kategorier, {validering.Omraden?.Count ?? 0} områden",
            ChangedBy = "user",
        });
        await _db.SaveChangesAsync();

        return Ok(ToDto(bevakning));
    }

    [HttpPut("{id}")]
    [RequestSizeLimit(MaxRequestBytes)]
    public async Task<IActionResult> Update(Guid id, [FromBody] BevakningRequest req)
    {
        var validering = PolisenBevakningValidator.Validera(req.Kategorier, req.Omraden);
        if (!validering.Ok) return BadRequest(validering.Fel);

        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == id && b.UserId == CurrentUserId);
        if (bevakning == null) return NotFound();

        var gammaltVärde = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}";
        bevakning.KategorierJson = validering.Kategorier == null ? null : JsonSerializer.Serialize(validering.Kategorier);
        bevakning.OmradenJson = validering.Omraden == null ? null : JsonSerializer.Serialize(validering.Omraden);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = CurrentUserId,
            Setting = "polisen_bevakning_ändrad",
            OldValue = gammaltVärde,
            NewValue = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}",
            ChangedBy = "user",
        });
        await _db.SaveChangesAsync();

        return Ok(ToDto(bevakning));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var bevakning = await _db.PolisenBevakningar.FirstOrDefaultAsync(b => b.Id == id && b.UserId == CurrentUserId);
        if (bevakning == null) return NotFound();

        _db.PolisenBevakningar.Remove(bevakning);
        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = CurrentUserId,
            Setting = "polisen_bevakning_borttagen",
            OldValue = $"{bevakning.KategorierJson ?? "[]"} / {bevakning.OmradenJson ?? "[]"}",
            NewValue = null,
            ChangedBy = "user",
        });
        await _db.SaveChangesAsync();

        return Ok();
    }

    private static BevakningResponse ToDto(PolisenBevakning b) => new(
        Id: b.Id,
        Kategorier: b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson),
        Omraden: b.OmradenJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson)
    );
}

public record BevakningRequest(List<string>? Kategorier, List<string>? Omraden);
public record BevakningResponse(Guid Id, List<string>? Kategorier, List<string>? Omraden);
