namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Global, databas-backad admininställning för Logga in/Skapa konto-knapparna
// i sidomenyn — ersätter den felaktiga per-webbläsare localStorage-flaggan i
// frontend (lib/featureFlags.ts). Singleton-rad (Id = 1), samma konvention
// som andra enkla admin-inställningar i projektet.
[ApiController]
public class SiteSettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public SiteSettingsController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    [HttpGet("api/settings/site")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSiteSettings()
    {
        var settings = await GetOrCreateAsync();
        return Ok(new { settings.ShowLoginButton, settings.ShowRegisterButton });
    }

    [HttpPut("api/admin/settings/site")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSiteSettings([FromBody] UpdateSiteSettingsRequest req)
    {
        var settings = await GetOrCreateAsync();
        var ändringar = new List<string>();
        if (req.ShowLoginButton.HasValue && req.ShowLoginButton.Value != settings.ShowLoginButton)
        {
            ändringar.Add($"Logga in-knapp: {settings.ShowLoginButton} → {req.ShowLoginButton.Value}");
            settings.ShowLoginButton = req.ShowLoginButton.Value;
        }
        if (req.ShowRegisterButton.HasValue && req.ShowRegisterButton.Value != settings.ShowRegisterButton)
        {
            ändringar.Add($"Skapa konto-knapp: {settings.ShowRegisterButton} → {req.ShowRegisterButton.Value}");
            settings.ShowRegisterButton = req.ShowRegisterButton.Value;
        }
        await _db.SaveChangesAsync();
        if (ändringar.Count > 0)
            await _aktivitetslogg.LogAsync(
                AktörTyper.Admin, LoggTyper.Konfiguration,
                "SiteSettings ändrat", string.Join(", ", ändringar));
        return Ok(new { settings.ShowLoginButton, settings.ShowRegisterButton });
    }

    private async Task<SiteSettings> GetOrCreateAsync()
    {
        var settings = await _db.SiteSettings.FirstOrDefaultAsync(s => s.Id == 1);
        if (settings == null)
        {
            settings = new SiteSettings { Id = 1, ShowLoginButton = true, ShowRegisterButton = true };
            _db.SiteSettings.Add(settings);
            await _db.SaveChangesAsync();
        }
        return settings;
    }
}

public record UpdateSiteSettingsRequest(bool? ShowLoginButton, bool? ShowRegisterButton);
