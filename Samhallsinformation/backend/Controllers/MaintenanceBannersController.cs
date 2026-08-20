namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Publik läsning (alla besökare behöver kunna se meddelandena för att
// banderollen ska synas innan inloggning), admin-styrd skrivning. Flera rader
// kan vara aktiva samtidigt — tid- och målgruppsfiltrering sker i frontend,
// inte här, så admin-panelen kan visa/redigera även framtida och redan
// avslutade meddelanden.
[ApiController]
public class MaintenanceBannersController : ControllerBase
{
    private static readonly string[] GiltigaMålgrupper = ["Alla", "Besökare", "Användare"];

    private readonly AppDbContext _db;

    public MaintenanceBannersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("api/maintenance-banners")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var banners = await _db.MaintenanceBanners.OrderBy(b => b.StartUtc).ToListAsync();
        return Ok(banners.Select(ToDto));
    }

    [HttpPost("api/admin/maintenance-banners")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] MaintenanceBannerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest("Meddelande krävs.");
        if (!GiltigaMålgrupper.Contains(req.Audience)) return BadRequest("Ogiltig målgrupp.");
        if (req.EndUtc <= req.StartUtc) return BadRequest("Sluttid måste vara efter starttid.");

        var banner = new MaintenanceBanner
        {
            Id        = Guid.NewGuid(),
            Message   = req.Message.Trim(),
            StartUtc  = req.StartUtc,
            EndUtc    = req.EndUtc,
            Audience  = req.Audience,
            CreatedAt = DateTime.UtcNow,
        };
        _db.MaintenanceBanners.Add(banner);
        await _db.SaveChangesAsync();
        return Ok(ToDto(banner));
    }

    [HttpPut("api/admin/maintenance-banners/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MaintenanceBannerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest("Meddelande krävs.");
        if (!GiltigaMålgrupper.Contains(req.Audience)) return BadRequest("Ogiltig målgrupp.");
        if (req.EndUtc <= req.StartUtc) return BadRequest("Sluttid måste vara efter starttid.");

        var banner = await _db.MaintenanceBanners.FindAsync(id);
        if (banner == null) return NotFound();

        banner.Message  = req.Message.Trim();
        banner.StartUtc = req.StartUtc;
        banner.EndUtc   = req.EndUtc;
        banner.Audience = req.Audience;
        await _db.SaveChangesAsync();
        return Ok(ToDto(banner));
    }

    [HttpDelete("api/admin/maintenance-banners/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var banner = await _db.MaintenanceBanners.FindAsync(id);
        if (banner == null) return NotFound();
        _db.MaintenanceBanners.Remove(banner);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object ToDto(MaintenanceBanner b) => new
    {
        b.Id,
        b.Message,
        b.StartUtc,
        b.EndUtc,
        b.Audience,
    };
}

public record MaintenanceBannerRequest(string Message, DateTime StartUtc, DateTime EndUtc, string Audience);
