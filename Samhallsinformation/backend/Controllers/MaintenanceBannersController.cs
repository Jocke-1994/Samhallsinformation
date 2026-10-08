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
    private static readonly string[] GiltigaStilar     = ["Drift", "Nyhet", "Kommande"];

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
            Stil      = req.Stil!,
            Rubrik    = req.Rubrik,
            LankUrl   = req.LankUrl,
            CreatedAt = DateTime.UtcNow,
        };
        _db.MaintenanceBanners.Add(banner);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Driftmeddelande skapat", LoggDetalj(banner));
        return Ok(ToDto(banner));
    }

    [HttpPut("api/admin/maintenance-banners/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MaintenanceBannerRequest req)
    {
        var banner = await _db.MaintenanceBanners.FindAsync(id);
        if (banner == null) return NotFound();

        // En äldre adminflik (öppen sedan innan stilfältet fanns) skickar inte
        // Stil/Rubrik/LankUrl alls — behåll då de sparade värdena istället för
        // att tyst nollställa en nyhetsbanderoll till en orange driftbanderoll.
        if (req.Stil == null)
            req = req with { Stil = banner.Stil, Rubrik = banner.Rubrik, LankUrl = banner.LankUrl };

        req = NormaliseraTider(req);
        var fel = Validera(req);
        if (fel != null) return BadRequest(fel);

        banner.Message  = req.Message.Trim();
        banner.StartUtc = req.StartUtc;
        banner.EndUtc   = req.EndUtc;
        banner.Audience = req.Audience;
        banner.Stil     = req.Stil!;
        banner.Rubrik   = req.Rubrik;
        banner.LankUrl  = req.LankUrl;
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Driftmeddelande redigerat", LoggDetalj(banner));
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
    // Tomma valfria fält blir null, och en klient som inte skickar Stil
    // (äldre frontend) får "Drift" — samma beteende som innan fältet fanns.
    private static MaintenanceBannerRequest NormaliseraTider(MaintenanceBannerRequest req) => req with
    {
        StartUtc = UtcDateTime.Ensure(req.StartUtc),
        EndUtc   = UtcDateTime.Ensure(req.EndUtc),
        Stil     = string.IsNullOrWhiteSpace(req.Stil) ? "Drift" : req.Stil.Trim(),
        // Banderollen sätter själv ":" efter rubriken på dator — ett avslutande
        // kolon i rubriken skulle annars visas dubbelt.
        Rubrik   = string.IsNullOrWhiteSpace(req.Rubrik) ? null : req.Rubrik.Trim().TrimEnd(':').TrimEnd() is { Length: > 0 } r ? r : null,
        LankUrl  = string.IsNullOrWhiteSpace(req.LankUrl) ? null : req.LankUrl.Trim(),
    };

    private static string? Validera(MaintenanceBannerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))         return "Meddelande krävs.";
        if (!GiltigaMålgrupper.Contains(req.Audience))      return "Ogiltig målgrupp.";
        if (!GiltigaStilar.Contains(req.Stil))              return "Ogiltig stil.";
        if (req.EndUtc <= req.StartUtc)                     return "Sluttid måste vara efter starttid.";
        if (req.LankUrl != null && !ArInternSokvag(req.LankUrl))
            return "Länken måste vara en sökväg på sajten, t.ex. /uppdateringar.";
        return null;
    }

    // "/uppdateringar" och "/uppdateringar#v0.8:nyheter" ja; "//evil.se", "/\evil.se",
    // "https://…", "javascript:…" nej. Mellanslag och kontrolltecken (tabb, radbrytning)
    // nekas helt — webbläsaren stryker dem vid URL-tolkning, så "/<TAB>/evil.se" blir
    // annars "//evil.se". Ett schema ("x:") kan aldrig komma före en inledande "/".
    // Samma regel i frontend: lib/banderoll.ts (arInternSokvag).
    private static bool ArInternSokvag(string url) =>
        url.StartsWith('/') && !url.StartsWith("//")
        && !url.Contains('\\') && !url.Any(c => char.IsControl(c) || char.IsWhiteSpace(c));

    private static string LoggDetalj(MaintenanceBanner b) =>
        $"{b.Audience}, {b.Stil}: {(b.Rubrik != null ? b.Rubrik + ": " : "")}{b.Message}"
        + (b.LankUrl != null ? $" (Läs mer → {b.LankUrl})" : "");

    private static object ToDto(MaintenanceBanner b) => new
    {
        b.Id,
        b.Message,
        b.StartUtc,
        b.EndUtc,
        b.Audience,
        b.Stil,
        b.Rubrik,
        b.LankUrl,
    };
}

public record MaintenanceBannerRequest(
    string Message, DateTime StartUtc, DateTime EndUtc, string Audience,
    string? Stil = null, string? Rubrik = null, string? LankUrl = null);
