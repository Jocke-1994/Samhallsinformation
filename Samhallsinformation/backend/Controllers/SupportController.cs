namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
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
    private readonly IAktivitetsloggService _aktivitetslogg;

    public SupportController(AppDbContext db, IPushNotificationService push, IConfiguration config, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _push = push;
        _config = config;
        _aktivitetslogg = aktivitetslogg;
    }

    private Guid? CurrentUserId =>
        User.Identity?.IsAuthenticated == true
            ? Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!)
            : null;

    [HttpPost("tickets")]
    [AllowAnonymous]
    [EnableRateLimiting(SupportTicketRateLimit.PolicyName)]
    public async Task<IActionResult> Create([FromBody] CreateTicketRequest req)
    {
        var userId = CurrentUserId;

        // ContactEmail är frivilligt — bara nödvändigt om avsändaren vill ha
        // svar, inte för att skicka in något. Ett anonymt inskick utan e-post
        // är ett giltigt, avsiktligt "kasta över muren"-meddelande.
        var (subject, category, message, contactName, contactEmail) =
            (req.Subject, req.Category, req.Message, req.ContactName, req.ContactEmail);

        // Kundtjänstboten kan inte visa ett 400 för en människa: dess inskick
        // avkortas/rensas i stället för att avvisas på längd/e-post/kategori.
        // Övriga kanaler (app-formulären) får strikta gränser med 400.
        if (req.Channel == SupportTicketValidator.BotChannel)
            (subject, category, message, contactName, contactEmail) =
                SupportTicketValidator.SanitizeBotInput(subject, category, message, contactName, contactEmail);

        var fel = SupportTicketValidator.Validate(subject, category, message, req.Channel, contactName, contactEmail);
        if (fel != null)
            return BadRequest(fel);

        User? user = userId != null ? await _db.Users.FindAsync(userId.Value) : null;

        // TicketNumber tilldelas av applikationen, inte databasen — portabelt
        // mellan SQLite (lokalt) och Postgres (prod) utan databasspecifika sequences.
        var nextNumber = (await _db.SupportTickets.MaxAsync(t => (int?)t.TicketNumber) ?? 0) + 1;

        var ticket = new SupportTicket
        {
            TicketNumber = nextNumber,
            Subject = string.IsNullOrWhiteSpace(subject) ? "Feedback" : subject.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "Feedback" : category.Trim(),
            Channel = req.Channel,
            CreatedByUserId = userId,
            ContactName = user?.Name ?? NullIfBlank(contactName),
            ContactEmail = user?.Email ?? NullIfBlank(contactEmail),
            LastUserMessageAt = DateTime.UtcNow,
        };
        _db.SupportTickets.Add(ticket);

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            Ticket = ticket,
            SenderType = "user",
            AuthorUserId = userId,
            Text = message!.Trim(),
        });

        await _db.SaveChangesAsync();

        await _aktivitetslogg.LogAsync(
            AktörTyper.System, LoggTyper.Ärende,
            $"Ärende öppnat — {ticket.Subject}", $"{ticket.ContactName ?? "Okänd"} — {ticket.Category}",
            relateratÄrendeId: ticket.Id);

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

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
            TicketId = ticket.Id,
            SenderType = "user",
            AuthorUserId = userId,
            Text = req.Text,
        });
        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.LastUserMessageAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        try
        {
            var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
            await PushDispatcher.DispatchTicketReplyAsync(_db, _push, frontendUrl, ticket);
        }
        catch (Exception)
        {
            // Push-fel ska aldrig fela svaret — samma princip som Create() ovan.
        }

        return Ok();
    }
}

public record CreateTicketRequest(string? Subject, string? Category, string Message, string Channel, string? ContactName, string? ContactEmail);
public record ReplyRequest(string Text);
