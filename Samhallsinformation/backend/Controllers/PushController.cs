namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

[ApiController]
[Route("api/push")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPushNotificationService _push;

    public PushController(AppDbContext db, IConfiguration config, IPushNotificationService push)
    {
        _db     = db;
        _config = config;
        _push   = push;
    }

    // Diagnostikverktyg (session 2026-08-14): admin fick inga push-notiser,
    // och NotificationDeliveryLog-räknaren stod stilla trots att enheten
    // omprenumererades — den här listar vilka UserDevices-rader som faktiskt
    // finns, för att se om enheten över huvud taget når databasen.
    [HttpGet("devices")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ListDevices()
    {
        var rows = await _db.UserDevices
            .Include(d => d.User)
            .OrderByDescending(d => d.LastSeenAt)
            .ToListAsync();

        var devices = rows.Select(d => new
        {
            d.Id,
            UserEmail       = d.User.Email,
            UserRole        = d.User.Role,
            UserPushEnabled = d.User.PushEnabled,
            d.DeviceName,
            d.Platform,
            d.RegisteredAt,
            d.LastSeenAt,
            EndpointPreview = d.Endpoint.Length > 60 ? d.Endpoint[..60] + "…" : d.Endpoint,
        });

        return Ok(devices);
    }

    // Skickar en riktig testpush till alla enheter kopplade till den
    // inloggade admin-användaren — för att isolera om problemet är
    // dispatch-logiken (hittar ingen enhet) eller själva WebPush-leveransen.
    [HttpPost("test")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendTest()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var devices = await _db.UserDevices.Where(d => d.UserId == userId).ToListAsync();

        if (devices.Count == 0)
            return Ok(new { sent = 0, message = "Inga registrerade enheter för det här kontot" });

        var results = new List<object>();
        foreach (var device in devices)
        {
            try
            {
                await _push.SendAsync(device, "Testpush", "Det här är en testnotis från Felsökning", null);
                results.Add(new { device.Id, device.DeviceName, status = "sent" });
            }
            catch (Exception ex)
            {
                results.Add(new { device.Id, device.DeviceName, status = "failed", error = ex.Message });
            }
        }

        return Ok(new { sent = results.Count, results });
    }

    // Diagnostikverktyg: visar de senaste leveransförsöken (status/felmeddelande
    // per enhet) — den enda platsen att se VARFÖR ett skickat push misslyckades,
    // eftersom Rapporter bara visar ett totalt antal utan status-uppdelning.
    [HttpGet("logs")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ListLogs()
    {
        var rows = await _db.NotificationDeliveryLogs
            .Include(l => l.User)
            .Where(l => l.Channel == "push")
            .OrderByDescending(l => l.SentAt)
            .Take(20)
            .ToListAsync();

        var logs = rows.Select(l => new
        {
            l.Id,
            UserEmail = l.User.Email,
            l.Status,
            l.ErrorMessage,
            l.Subject,
            RecipientPreview = l.Recipient.Length > 60 ? l.Recipient[..60] + "…" : l.Recipient,
            l.SentAt,
        });

        return Ok(logs);
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
