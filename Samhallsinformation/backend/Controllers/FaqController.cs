namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Faq;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/[controller]")]
public class FaqController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public FaqController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    // Filtrerar nu även på flaggans EFFEKTIVA status (kodens default +
    // admins ev. avvikelse), inte bara Publicerad — annars skulle en extern
    // konsument (kundtjänstboten, se docs/vault/Ideer/FAQ-synk-
    // kundtjanstbot.md) kunna svara på frågor om avstängda funktioner, något
    // vår egen frontend redan skyddar sig mot genom att filtrera om det en
    // gång till klientsidan (FaqKort.tsx, oförändrad, ofarlig dubblering).
    [HttpGet]
    public async Task<IActionResult> GetFaq()
    {
        // En flagga som bara admin ser (EndastAdmin, betatest) räknas som
        // avstängd för alla andra, samma regel som GET /api/feature-flags.
        // Annars skulle besökare och kundtjänstboten få frågor om funktioner
        // som inte är lanserade.
        var ärAdmin = User?.IsInRole("Admin") == true;
        var overrides = await _db.FeatureFlagOverrides
            .ToDictionaryAsync(f => f.Key, f => f.EndastAdmin && f.Value && !ärAdmin ? false : f.Value);
        var items = await _db.FaqItems
            .Where(f => f.Publicerad)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync();

        var synliga = items
            .Where(f => f.FlagKey == null || FeatureFlagDefaults.IsEffectivelyActive(f.FlagKey, overrides))
            .Select(FaqDto.From)
            .ToList();
        return Ok(synliga);
    }

    [HttpGet("/api/admin/faq")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminFaq()
    {
        var items = await _db.FaqItems.OrderBy(f => f.CreatedAt).ToListAsync();
        return Ok(items);
    }

    [HttpPost("/api/admin/faq")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateFaq([FromBody] FaqRequest req)
    {
        var item = new FaqItem
        {
            Kategori = req.Kategori,
            Fraga = req.Fraga,
            Svar = req.Svar,
            Publicerad = req.Publicerad,
            FlagKey = req.FlagKey,
        };
        _db.FaqItems.Add(item);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"FAQ skapad — {item.Fraga}", $"Kategori {item.Kategori}, {(item.Publicerad ? "publicerad" : "dold")}");
        return Ok(item);
    }

    [HttpPut("/api/admin/faq/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateFaq(Guid id, [FromBody] FaqRequest req)
    {
        var item = await _db.FaqItems.FindAsync(id);
        if (item == null) return NotFound();

        var publiceradFörut = item.Publicerad;

        item.Kategori = req.Kategori;
        item.Fraga = req.Fraga;
        item.Svar = req.Svar;
        item.Publicerad = req.Publicerad;
        item.FlagKey = req.FlagKey;
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        var detalj = publiceradFörut != req.Publicerad
            ? (req.Publicerad ? "Publicerad" : "Dold")
            : "Innehåll redigerat";
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"FAQ redigerad — {item.Fraga}", detalj);
        return Ok(item);
    }

    [HttpDelete("/api/admin/faq/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteFaq(Guid id)
    {
        var item = await _db.FaqItems.FindAsync(id);
        if (item == null) return NotFound();

        var fråga = item.Fraga;
        _db.FaqItems.Remove(item);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"FAQ borttagen — {fråga}", "");
        return NoContent();
    }
}

public record FaqRequest(string Kategori, string Fraga, string Svar, bool Publicerad, string? FlagKey);
