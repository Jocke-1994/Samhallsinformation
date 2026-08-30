namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
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

    [HttpGet]
    public async Task<IActionResult> GetFaq()
    {
        var items = await _db.FaqItems
            .Where(f => f.Publicerad)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync();
        return Ok(items);
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
            Kategori   = req.Kategori,
            Fraga      = req.Fraga,
            Svar       = req.Svar,
            Publicerad = req.Publicerad,
            FlagKey    = req.FlagKey,
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

        item.Kategori   = req.Kategori;
        item.Fraga      = req.Fraga;
        item.Svar       = req.Svar;
        item.Publicerad = req.Publicerad;
        item.FlagKey    = req.FlagKey;

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
