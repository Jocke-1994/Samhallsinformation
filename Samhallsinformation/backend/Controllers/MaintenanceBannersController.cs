namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Publik läsning (alla besökare behöver kunna se meddelandena för att
// banderollen ska synas innan inloggning), admin-styrd skrivning. Flera rader
// kan vara aktiva samtidigt. Den publika listan filtreras på servern (bara
// pågående banderoller med rätt målgrupp för anroparen) så framtida,
// avslutade och inloggad-bara meddelanden inte läcker till anonyma. Admin-
// panelen läser hela listan via GET api/admin/maintenance-banners.
[ApiController]
public class MaintenanceBannersController : ControllerBase
{
    private static readonly string[] GiltigaMålgrupper = ["Alla", "Besökare", "Användare"];

    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public MaintenanceBannersController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    [HttpGet("api/maintenance-banners")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        // [AllowAnonymous] men JWT-middleware fyller ändå User när en giltig
        // token skickas (samma mönster som SupportController.Create).
        var inloggad = User.Identity?.IsAuthenticated == true;
        var nu = DateTime.UtcNow;

        var banners = await _db.MaintenanceBanners
            .Where(b => b.StartUtc <= nu && nu <= b.EndUtc)
            .OrderBy(b => b.StartUtc)
            .ToListAsync();

        // "Alla" för alla; "Besökare" bara utloggade; "Användare" bara inloggade.
        // Admin/support räknas som inloggade — ingen egen intern målgrupp finns.
        var synliga = banners.Where(b =>
            b.Audience == "Alla"
            || (b.Audience == "Besökare" && !inloggad)
            || (b.Audience == "Användare" && inloggad));

        return Ok(synliga.Select(ToDto));
    }

    [HttpGet("api/admin/maintenance-banners")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllAdmin()
    {
        var banners = await _db.MaintenanceBanners.OrderBy(b => b.StartUtc).ToListAsync();
        return Ok(banners.Select(ToDto));
    }

    [HttpPost("api/admin/maintenance-banners")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] MaintenanceBannerRequest req)
    {
        req = NormaliseraTider(req);
        var fel = Validera(req);
        if (fel != null) return BadRequest(fel);

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
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Driftmeddelande skapat", $"{banner.Audience}: {banner.Message}");
        return Ok(ToDto(banner));
    }

    [HttpPut("api/admin/maintenance-banners/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MaintenanceBannerRequest req)
    {
        req = NormaliseraTider(req);
        var fel = Validera(req);
        if (fel != null) return BadRequest(fel);

        var banner = await _db.MaintenanceBanners.FindAsync(id);
        if (banner == null) return NotFound();

        banner.Message  = req.Message.Trim();
        banner.StartUtc = req.StartUtc;
        banner.EndUtc   = req.EndUtc;
        banner.Audience = req.Audience;
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Driftmeddelande redigerat", $"{banner.Audience}: {banner.Message}");
        return Ok(ToDto(banner));
    }

    [HttpDelete("api/admin/maintenance-banners/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var banner = await _db.MaintenanceBanners.FindAsync(id);
        if (banner == null) return NotFound();
        var meddelande = banner.Message;
        _db.MaintenanceBanners.Remove(banner);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Driftmeddelande borttaget", meddelande);
        return NoContent();
    }

    // V3-6: en JSON-sträng utan "Z" ger Kind=Unspecified, som Npgsql vägrar mot timestamptz.
    private static MaintenanceBannerRequest NormaliseraTider(MaintenanceBannerRequest req) => req with
    {
        StartUtc = UtcDateTime.Ensure(req.StartUtc),
        EndUtc   = UtcDateTime.Ensure(req.EndUtc),
    };

    private static string? Validera(MaintenanceBannerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))         return "Meddelande krävs.";
        if (!GiltigaMålgrupper.Contains(req.Audience))      return "Ogiltig målgrupp.";
        if (req.EndUtc <= req.StartUtc)                     return "Sluttid måste vara efter starttid.";
        return null;
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
