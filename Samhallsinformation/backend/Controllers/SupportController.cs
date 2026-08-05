namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Ersätter Formspree (50/inskick-tak) och den gamla mockade Ärendehanteringen —
// samma tabell tar emot både inloggade användares ärenden och anonyma
// feedback-inskick (Channel skiljer dem åt).
[ApiController]
[Route("api/support")]
public class SupportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPushNotificationService _push;
    private readonly IConfiguration _config;

    public SupportController(AppDbContext db, IPushNotificationService push, IConfiguration config)
    {
        _db     = db;
        _push   = push;
        _config = config;
    }

    private Guid? CurrentUserId =>
        User.Identity?.IsAuthenticated == true
            ? Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!)
            : null;

    [HttpPost("tickets")]
    [AllowAnonymous]
    public async Task<IActionResult> Create([FromBody] CreateTicketRequest req)
    {
        var userId = CurrentUserId;

        // ContactEmail är frivilligt — bara nödvändigt om avsändaren vill ha
        // svar, inte för att skicka in något. Ett anonymt inskick utan e-post
        // är ett giltigt, avsiktligt "kasta över muren"-meddelande.
        if (string.IsNullOrWhiteSpace(req.Message))
            return BadRequest("Message krävs.");

        User? user = userId != null ? await _db.Users.FindAsync(userId.Value) : null;

        // TicketNumber tilldelas av applikationen, inte databasen — portabelt
        // mellan SQLite (lokalt) och Postgres (prod) utan databasspecifika sequences.
        var nextNumber = (await _db.SupportTickets.MaxAsync(t => (int?)t.TicketNumber) ?? 0) + 1;

        var ticket = new SupportTicket
        {
            TicketNumber    = nextNumber,
            Subject         = string.IsNullOrWhiteSpace(req.Subject) ? "Feedback" : req.Subject,
            Category        = string.IsNullOrWhiteSpace(req.Category) ? "Feedback" : req.Category,
            Channel         = req.Channel,
            CreatedByUserId = userId,
            ContactName     = user?.Name ?? req.ContactName,
            ContactEmail    = user?.Email ?? req.ContactEmail,
        };
        _db.SupportTickets.Add(ticket);

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            Ticket       = ticket,
            SenderType   = "user",
            AuthorUserId = userId,
            Text         = req.Message,
        });

        await _db.SaveChangesAsync();

        try
        {
            var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
            await PushDispatcher.DispatchNewTicketAsync(_db, _push, frontendUrl, ticket);
        }
        catch (Exception)
        {
            // Push-fel ska aldrig fela ärendeskapelsen — samma princip som
            // IngestorBackgroundService redan använder runt PushDispatcher.
        }

        return Ok(new { ticket.Id, ticket.TicketNumber });
    }

    [HttpGet("tickets")]
    [Authorize]
    public async Task<IActionResult> GetMyTickets()
    {
        var userId = CurrentUserId!.Value;

        var tickets = await _db.SupportTickets
            .Where(t => t.CreatedByUserId == userId)
            .OrderByDescending(t => t.UpdatedAt)
            .Select(t => new
            {
                t.Id,
                t.TicketNumber,
                t.Subject,
                t.Category,
                t.Status,
                t.CreatedAt,
                t.UpdatedAt,
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpGet("tickets/{id}")]
    [Authorize]
    public async Task<IActionResult> GetMyTicket(Guid id)
    {
        var userId = CurrentUserId!.Value;

        var ticket = await _db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.CreatedByUserId == userId);
        if (ticket == null) return NotFound();

        var messages = await _db.SupportTicketMessages
            .Where(m => m.TicketId == id && !m.IsInternal)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id,
                m.SenderType,
                m.Text,
                m.CreatedAt,
                // Visar aldrig agentens riktiga Name — DisplayName om satt, annars
                // en generisk etikett. Se User.DisplayName-kommentaren.
                AuthorName = m.SenderType == "agent" ? (m.AuthorUser!.DisplayName ?? "Support") : null,
            })
            .ToListAsync();

        return Ok(new
        {
            ticket.Id,
            ticket.TicketNumber,
            ticket.Subject,
            ticket.Category,
            ticket.Status,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            Messages = messages,
        });
    }

    [HttpPost("tickets/{id}/reply")]
    [Authorize]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyRequest req)
    {
        var userId = CurrentUserId!.Value;

        var ticket = await _db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.CreatedByUserId == userId);
        if (ticket == null) return NotFound();

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId     = ticket.Id,
            SenderType   = "user",
            AuthorUserId = userId,
            Text         = req.Text,
        });
        ticket.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record CreateTicketRequest(string? Subject, string? Category, string Message, string Channel, string? ContactName, string? ContactEmail);
public record ReplyRequest(string Text);
