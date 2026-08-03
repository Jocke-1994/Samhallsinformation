namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/push")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PushController(AppDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    // Anonym — frontend behöver den publika nyckeln för pushManager.subscribe(),
    // innan användaren nödvändigtvis är inloggad i den flödet.
    [HttpGet("public-key")]
    [AllowAnonymous]
    public IActionResult GetPublicKey()
    {
        var publicKey = _config["VAPID_PUBLIC_KEY"];
        if (string.IsNullOrEmpty(publicKey)) return NotFound();
        return Ok(new { publicKey });
    }

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Upsert på Endpoint (inte UserId+Endpoint) — ett endpoint tillhör en
        // webbläsarinstans, senaste inloggade användaren äger subskriptionen.
        var device = await _db.UserDevices.FirstOrDefaultAsync(d => d.Endpoint == req.Endpoint);
        if (device == null)
        {
            device = new UserDevice { Endpoint = req.Endpoint };
            _db.UserDevices.Add(device);
        }

        device.UserId     = userId;
        device.P256dh     = req.Keys.P256dh;
        device.Auth       = req.Keys.Auth;
        device.DeviceName = req.DeviceName ?? device.DeviceName;
        device.Platform   = req.Platform   ?? device.Platform;
        device.LastSeenAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("subscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var device = await _db.UserDevices
            .FirstOrDefaultAsync(d => d.Endpoint == req.Endpoint && d.UserId == userId);
        if (device != null)
        {
            _db.UserDevices.Remove(device);
            await _db.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpGet("settings")]
    [Authorize]
    public async Task<IActionResult> GetSettings()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var pushEnabled = await _db.Users.Where(u => u.Id == userId).Select(u => u.PushEnabled).FirstAsync();
        return Ok(new { pushEnabled });
    }

    [HttpPut("settings")]
    [Authorize]
    public async Task<IActionResult> SaveSettings([FromBody] PushSettingsRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FirstAsync(u => u.Id == userId);
        user.PushEnabled = req.PushEnabled;
        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record SubscribeRequest(string Endpoint, SubscribeKeys Keys, string? DeviceName, string? Platform);
public record SubscribeKeys(string P256dh, string Auth);
public record UnsubscribeRequest(string Endpoint);
public record PushSettingsRequest(bool PushEnabled);
