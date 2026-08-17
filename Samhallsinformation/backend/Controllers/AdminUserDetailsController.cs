namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

// Läsvyer på en enskild användares konto, till Anvandare.tsx-detaljpanelen.
// Egen controller (inte AdminUsersController, som är Admin-only) eftersom
// Anvandare-sidan är Support-åtkomlig i UI:t (AdminPage.SUPPORT_SEKTIONER)
// — ett klassattribut kan inte "luckras upp" på metodnivå i ASP.NET Core,
// attributen är kumulativa (AND), inte en override.
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin,Support")]
public class AdminUserDetailsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminUserDetailsController(AppDbContext db) => _db = db;

    // Notishistorik för en enskild användare — samma NotificationDeliveryLog-
    // tabell som redan används aggregerat i StatsController.
    [HttpGet("{id}/notification-log")]
    public async Task<IActionResult> GetNotificationLog(Guid id)
    {
        var log = await (
            from l in _db.NotificationDeliveryLogs
            where l.UserId == id
            join src in _db.Sources on l.SourceId equals src.Id into srcJ
            from src in srcJ.DefaultIfEmpty()
            orderby l.SentAt descending
            select new
            {
                l.SentAt,
                l.Channel,
                SourceName = src != null ? src.ShortName : null,
                l.Subject,
                l.Recipient,
                l.Status,
                l.ErrorMessage,
            }
        ).Take(50).ToListAsync();

        return Ok(log);
    }
}
