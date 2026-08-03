namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Kör schemalagda supportärende-åtgärder (svar/intern-notering/ombokning) på
// riktigt, server-side — till skillnad från mockens setInterval i webbläsaren
// som bara körde medan admin-fliken råkade vara öppen.
public class SupportScheduledActionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SupportScheduledActionService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(60);

    public SupportScheduledActionService(IServiceScopeFactory scopeFactory, ILogger<SupportScheduledActionService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await ExecuteDueActionsAsync(db, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SupportScheduledActionService misslyckades — försöker igen om {Interval}", _interval);
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    public static async Task ExecuteDueActionsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await db.SupportTicketScheduledActions
            .Where(a => !a.Executed && a.ScheduledAt <= now)
            .ToListAsync(ct);

        foreach (var action in due)
        {
            var ticket = await db.SupportTickets.FindAsync([action.TicketId], ct);
            if (ticket == null) { action.Executed = true; action.ExecutedAt = now; continue; }

            switch (action.Type)
            {
                case "svar":
                    db.SupportTicketMessages.Add(new SupportTicketMessage
                    {
                        TicketId     = ticket.Id,
                        SenderType   = "agent",
                        AuthorUserId = action.CreatedByUserId,
                        Text         = action.Text ?? string.Empty,
                        IsInternal   = false,
                    });
                    break;

                case "intern":
                    db.SupportTicketMessages.Add(new SupportTicketMessage
                    {
                        TicketId     = ticket.Id,
                        SenderType   = "agent",
                        AuthorUserId = action.CreatedByUserId,
                        Text         = action.Text ?? string.Empty,
                        IsInternal   = true,
                    });
                    break;

                case "tilldela":
                    ticket.AssignedToUserId = action.ReassignToUserId;
                    var instruktion = string.IsNullOrWhiteSpace(action.Instruction) ? "" : $" — {action.Instruction}";
                    db.SupportTicketMessages.Add(new SupportTicketMessage
                    {
                        TicketId     = ticket.Id,
                        SenderType   = "agent",
                        AuthorUserId = action.CreatedByUserId,
                        Text         = $"Ärendet ombokat automatiskt (schemalagd åtgärd){instruktion}",
                        IsInternal   = true,
                    });
                    break;
            }

            ticket.UpdatedAt   = now;
            action.Executed    = true;
            action.ExecutedAt  = now;
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
