namespace Samhallsinformation.Application.Support;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

public class SupportReplyDelivery : ISupportReplyDelivery
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly IEmailService _email;
    private readonly ILogger<SupportReplyDelivery> _logger;

    public SupportReplyDelivery(
        AppDbContext db, IAktivitetsloggService aktivitetslogg, IEmailService email, ILogger<SupportReplyDelivery> logger)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
        _email = email;
        _logger = logger;
    }

    public async Task DeliverAsync(SupportReplyDeliveryRequest request, Action? beforeSave = null, CancellationToken ct = default)
    {
        var ticket = request.Ticket;

        // Adressen kan komma från kontot (inloggad medborgare utan ContactEmail).
        if (ticket.CreatedByUserId != null)
            await _db.Entry(ticket).Reference(t => t.CreatedByUser).LoadAsync(ct);

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId     = ticket.Id,
            SenderType   = "agent",
            AuthorUserId = request.AuthorUserId,
            Text         = request.Text,
            IsInternal   = request.IsInternal,
        });
        ticket.UpdatedAt = DateTime.UtcNow;
        beforeSave?.Invoke();

        // Från och med här är svaret sparat. Allt nedan är bieffekter som aldrig får
        // få det sparade svaret att se misslyckat ut — och aldrig kan leda till omkörning.
        await _db.SaveChangesAsync(ct);

        var ärendeNummer = $"SUP-{ticket.TicketNumber:D4}";

        // Skickas som riktigt mejl bara för svar avsedda för medborgaren — en adress att
        // skicka till måste finnas (anonym feedback utan ContactEmail har ingen).
        if (!request.IsInternal)
        {
            var toEmail = ticket.ContactEmail ?? ticket.CreatedByUser?.Email;
            if (!string.IsNullOrWhiteSpace(toEmail))
            {
                try
                {
                    await _email.SendTicketReplyAsync(toEmail, ticket.TicketNumber, ticket.Subject, request.Text, ticket.InboundAddress);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Kunde inte skicka ärendesvar som mejl för ärende {TicketNumber}", ticket.TicketNumber);
                }
            }
            else
            {
                _logger.LogInformation("Ärende {TicketNumber} har ingen kontaktadress — svaret sparades men mejlades inte", ticket.TicketNumber);
            }
        }

        try
        {
            var detalj = request.IsInternal
                ? (request.Scheduled ? $"Schemalagd intern anteckning — {ärendeNummer}" : $"Intern anteckning — {ärendeNummer}")
                : (request.Scheduled ? $"Schemalagt svar skickat till medborgaren — {ärendeNummer}" : $"Svar skickat till medborgaren — {ärendeNummer}");
            await _aktivitetslogg.LogAsync(
                request.AktörTyp, LoggTyper.Ärende,
                $"Ärende svarat — {ticket.Subject}", detalj,
                relateratÄrendeId: ticket.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte skriva aktivitetslogg för ärendesvar på ärende {TicketNumber}", ticket.TicketNumber);
        }
    }
}
