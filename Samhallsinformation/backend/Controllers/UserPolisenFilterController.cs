namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Polisen-specifikt (FAS 4, #298) — se UserPolisenFilter för varför det inte
// är generellt per källa. null-fält = ej anpassat (allt), JSON-array = valt
// urval (kan vara tom = matcha inget).
[ApiController]
[Route("api/user/polisen-filter")]
[Authorize]
public class UserPolisenFilterController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserPolisenFilterController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var filter = await _db.UserPolisenFilters.FirstOrDefaultAsync(f => f.UserId == userId);

        return Ok(new PolisenFilterResponse(
            Kategorier: filter?.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(filter.KategorierJson),
            Omraden:    filter?.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(filter.OmradenJson)
        ));
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] PolisenFilterRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var filter = await _db.UserPolisenFilters.FirstOrDefaultAsync(f => f.UserId == userId);
        if (filter == null)
        {
            filter = new UserPolisenFilter { UserId = userId };
            _db.UserPolisenFilters.Add(filter);
        }

        filter.KategorierJson = req.Kategorier == null ? null : JsonSerializer.Serialize(req.Kategorier);
        filter.OmradenJson    = req.Omraden    == null ? null : JsonSerializer.Serialize(req.Omraden);

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record PolisenFilterRequest(List<string>? Kategorier, List<string>? Omraden);
public record PolisenFilterResponse(List<string>? Kategorier, List<string>? Omraden);
