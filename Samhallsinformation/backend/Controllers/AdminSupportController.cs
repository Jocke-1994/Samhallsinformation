namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

[ApiController]
[Route("api/admin/support")]
[Authorize(Roles = "Admin")]
public class AdminSupportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly IEmailService _email;
    private readonly ILogger<AdminSupportController> _logger;

    public AdminSupportController(AppDbContext db, IAktivitetsloggService aktivitetslogg, IEmailService email, ILogger<AdminSupportController> logger)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
        _email = email;
        _logger = logger;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("agents")]
    public async Task<IActionResult> GetAgents()
    {
        var agents = await _db.Users
            .Where(u => u.Role == "Admin" || u.Role == "Support")
            .Select(u => new { u.Id, u.Name })
            .ToListAsync();

        return Ok(agents);
    }

    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets([FromQuery] Guid? userId, [FromQuery] string? status)
    {
        var query = _db.SupportTickets.AsQueryable();
        if (userId != null) query = query.Where(t => t.CreatedByUserId == userId);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(t => t.Status == status);

        var tickets = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Select(t => new
            {
                t.Id,
                t.TicketNumber,
                t.Subject,
                t.Category,
                t.Status,
                t.Channel,
                t.ContactName,
                t.ContactEmail,
                t.AssignedToUserId,
                AssignedToName = t.AssignedToUser != null ? t.AssignedToUser.Name : null,
                t.IsArchived,
                t.FirstOpenedAt,
                t.CreatedAt,
                t.UpdatedAt,
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpGet("tickets/{id}")]
    public async Task<IActionResult> GetTicket(Guid id)
    {
        // Markera som läst (första öppningen) innan projektionen byggs, så
        // svaret nedan redan speglar det nya värdet.
        var entity = await _db.SupportTickets.FindAsync(id);
        if (entity == null) return NotFound();
        if (entity.FirstOpenedAt == null)
        {
            entity.FirstOpenedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        var ticket = await _db.SupportTickets
            .Where(t => t.Id == id)
            .Select(t => new
            {
                t.Id,
                t.TicketNumber,
                t.Subject,
                t.Category,
                t.Status,
                t.Channel,
                t.ContactName,
                t.ContactEmail,
                CreatedByName = t.CreatedByUser != null ? t.CreatedByUser.Name : null,
                t.AssignedToUserId,
                AssignedToName = t.AssignedToUser != null ? t.AssignedToUser.Name : null,
                t.ReminderAt,
                t.ReminderNote,
                t.IsArchived,
                t.FirstOpenedAt,
                t.CreatedAt,
                t.UpdatedAt,
            })
            .FirstOrDefaultAsync();
        if (ticket == null) return NotFound();

        var messages = await _db.SupportTicketMessages
            .Where(m => m.TicketId == id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id,
                m.SenderType,
                AuthorName = m.AuthorUser != null ? m.AuthorUser.Name : null,
                m.Text,
                m.IsInternal,
                m.CreatedAt,
            })
            .ToListAsync();

        var scheduled = await _db.SupportTicketScheduledActions
            .Where(a => a.TicketId == id)
            .OrderBy(a => a.ScheduledAt)
            .Select(a => new
            {
                a.Id,
                a.Type,
                a.ScheduledAt,
                CreatedByName = a.CreatedByUser.Name,
                a.Text,
                a.ReassignToUserId,
                ReassignToName = a.ReassignToUser != null ? a.ReassignToUser.Name : null,
                a.Instruction,
                a.Executed,
                a.ExecutedAt,
            })
            .ToListAsync();

        return Ok(new { Ticket = ticket, Messages = messages, ScheduledActions = scheduled });
    }

    [HttpPost("tickets/{id}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] AgentReplyRequest req)
    {
        var ticket = await _db.SupportTickets.Include(t => t.CreatedByUser).FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null) return NotFound();

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId     = ticket.Id,
            SenderType   = "agent",
            AuthorUserId = CurrentUserId,
            Text         = req.Text,
            IsInternal   = req.IsInternal,
        });
        ticket.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Ärende,
            $"Ärende svarat — {ticket.Subject}", req.IsInternal ? "Intern anteckning" : "Svar till medborgaren");

        // Skickas som riktigt mejl bara för svar avsedda för medborgaren — en
        // adress att skicka till måste finnas (anonym feedback utan ContactEmail
        // har ingen). Ett Resend-fel ska aldrig få det redan sparade svaret att
        // se ut som att det misslyckades, därför fångas felet och loggas istället.
        if (!req.IsInternal)
        {
            var toEmail = ticket.ContactEmail ?? ticket.CreatedByUser?.Email;
            if (!string.IsNullOrWhiteSpace(toEmail))
            {
                try
                {
                    await _email.SendTicketReplyAsync(toEmail, ticket.TicketNumber, ticket.Subject, req.Text);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Kunde inte skicka ärendesvar som mejl för ärende {TicketNumber}", ticket.TicketNumber);
                }
            }
        }

        return Ok();
    }

    [HttpPut("tickets/{id}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetStatusRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();

        var gammalStatus = ticket.Status;
        ticket.Status    = req.Status;
        ticket.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Ärende,
            $"Ärendestatus ändrad — {ticket.Subject}", $"{gammalStatus} → {req.Status}",
            gammaltVärde: gammalStatus, nyttVärde: req.Status);
        return Ok();
    }

    [HttpPut("tickets/{id}/archive")]
    public async Task<IActionResult> SetArchived(Guid id, [FromBody] SetArchivedRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();

        ticket.IsArchived = req.Archived;
        ticket.UpdatedAt  = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Ärende,
            req.Archived ? $"Ärende arkiverat — {ticket.Subject}" : $"Ärende återställt från arkiv — {ticket.Subject}", "");
        return Ok();
    }

    [HttpPut("tickets/{id}/assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();

        ticket.AssignedToUserId = req.UserId;
        ticket.UpdatedAt        = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var tilldeladNamn = req.UserId == null
            ? "Otilldelad"
            : (await _db.Users.FindAsync(req.UserId.Value))?.Name ?? "Okänd";
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Ärende,
            $"Ärende tilldelat — {ticket.Subject}", tilldeladNamn);
        return Ok();
    }

    [HttpPut("tickets/{id}/reminder")]
    public async Task<IActionResult> SetReminder(Guid id, [FromBody] SetReminderRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();

        ticket.ReminderAt   = req.ReminderAt;
        ticket.ReminderNote = req.ReminderNote;
        ticket.UpdatedAt    = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("tickets/{id}/scheduled-actions")]
    public async Task<IActionResult> AddScheduledAction(Guid id, [FromBody] AddScheduledActionRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();

        var action = new SupportTicketScheduledAction
        {
            TicketId         = ticket.Id,
            Type             = req.Type,
            ScheduledAt      = req.ScheduledAt,
            CreatedByUserId  = CurrentUserId,
            Text             = req.Text,
            ReassignToUserId = req.ReassignToUserId,
            Instruction      = req.Instruction,
        };
        _db.SupportTicketScheduledActions.Add(action);
        await _db.SaveChangesAsync();
        return Ok(new { action.Id });
    }

    [HttpDelete("scheduled-actions/{id}")]
    public async Task<IActionResult> CancelScheduledAction(Guid id)
    {
        var action = await _db.SupportTicketScheduledActions.FirstOrDefaultAsync(a => a.Id == id && !a.Executed);
        if (action == null) return NotFound();

        _db.SupportTicketScheduledActions.Remove(action);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Härledd, inte persisterad — samma modell som mocken (klienten sköter
    // läst/avfärdat lokalt). Två typer: övertidad påminnelse, eller tilldelad till mig.
    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications()
    {
        var myId = CurrentUserId;
        var now  = DateTime.UtcNow;

        var assignedToMe = await _db.SupportTickets
            .Where(t => t.AssignedToUserId == myId && t.Status != "Stängt")
            .Select(t => new { t.Id, t.Subject, t.ReminderAt, t.ReminderNote })
            .ToListAsync();

        var notiser = new List<object>();
        foreach (var t in assignedToMe)
        {
            notiser.Add(new { TicketId = t.Id, Amne = t.Subject, Typ = "tilldelad", Notering = (string?)null });
            if (t.ReminderAt != null && t.ReminderAt <= now)
                notiser.Add(new { TicketId = t.Id, Amne = t.Subject, Typ = "påminnelse", Notering = t.ReminderNote });
        }

        return Ok(notiser);
    }
}

public record AgentReplyRequest(string Text, bool IsInternal);
public record SetStatusRequest(string Status);
public record AssignRequest(Guid? UserId);
public record SetArchivedRequest(bool Archived);
public record SetReminderRequest(DateTime? ReminderAt, string? ReminderNote);
public record AddScheduledActionRequest(string Type, DateTime ScheduledAt, string? Text, Guid? ReassignToUserId, string? Instruction);
