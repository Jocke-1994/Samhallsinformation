namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    public SiteSettingsController(AppDbContext db)
    {
        _db = db;
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
        if (req.ShowLoginButton.HasValue)    settings.ShowLoginButton    = req.ShowLoginButton.Value;
        if (req.ShowRegisterButton.HasValue) settings.ShowRegisterButton = req.ShowRegisterButton.Value;
        await _db.SaveChangesAsync();
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
