namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
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
                var delivery = scope.ServiceProvider.GetRequiredService<ISupportReplyDelivery>();
                await ExecuteDueActionsAsync(db, delivery, _logger, stoppingToken);
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

    /// <summary>
    /// Kör alla förfallna åtgärder, en i taget med egen SaveChanges. En trasig åtgärd loggas
    /// och hoppas över — den fäller varken de andra åtgärderna eller bakgrundstjänsten.
    /// <paramref name="delivery"/> måste dela <paramref name="db"/> (samma scope).
    /// </summary>
    public static async Task ExecuteDueActionsAsync(
        AppDbContext db, ISupportReplyDelivery delivery, ILogger logger, CancellationToken ct = default)
    {
        var dueIds = await db.SupportTicketScheduledActions
            .Where(a => !a.Executed && a.ScheduledAt <= DateTime.UtcNow)
            .OrderBy(a => a.ScheduledAt)
            .Select(a => a.Id)
            .ToListAsync(ct);

        foreach (var id in dueIds)
        {
            try
            {
                await ExecuteOneAsync(db, delivery, id, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Schemalagd supportåtgärd {ActionId} kunde inte utföras — hoppar över och fortsätter", id);
                // Kasta bort halvfärdiga ändringar så de inte följer med nästa åtgärds SaveChanges.
                db.ChangeTracker.Clear();
            }
        }
    }

    private static async Task ExecuteOneAsync(AppDbContext db, ISupportReplyDelivery delivery, Guid actionId, CancellationToken ct)
    {
        var action = await db.SupportTicketScheduledActions.FirstOrDefaultAsync(a => a.Id == actionId && !a.Executed, ct);
        if (action == null) return;

        var now = DateTime.UtcNow;
        void MarkExecuted() { action.Executed = true; action.ExecutedAt = now; }

        var ticket = await db.SupportTickets.FindAsync([action.TicketId], ct);
        if (ticket == null)
        {
            MarkExecuted();
            await db.SaveChangesAsync(ct);
            return;
        }

        switch (action.Type)
        {
            case SupportScheduledActionValidator.Svar:
            case SupportScheduledActionValidator.Intern:
                // Samma väg som AdminSupportController.Reply (spara + mejla + logga). Åtgärden
                // markeras utförd i SAMMA SaveChanges som meddelandet, före mejlet skickas —
                // så ett mejlfel (som loggas, inte kastas) eller en omkörning kan inte ge dubbla utskick.
                await delivery.DeliverAsync(
                    new SupportReplyDeliveryRequest(
                        ticket, action.CreatedByUserId, action.Text ?? string.Empty,
                        IsInternal: action.Type == SupportScheduledActionValidator.Intern,
                        AktörTyp: AktörTyper.System, Scheduled: true),
                    beforeSave: MarkExecuted, ct);
                return;

            case SupportScheduledActionValidator.Tilldela:
                ticket.AssignedToUserId = action.ReassignToUserId;
                var instruktion = string.IsNullOrWhiteSpace(action.Instruction) ? "" : $" — {action.Instruction}";
                db.SupportTicketMessages.Add(new SupportTicketMessage
                {
                    TicketId = ticket.Id,
                    SenderType = "agent",
                    AuthorUserId = action.CreatedByUserId,
                    Text = $"Ärendet ombokat automatiskt (schemalagd åtgärd){instruktion}",
                    IsInternal = true,
                });
                break;
        }

        ticket.UpdatedAt = now;
        MarkExecuted();
        await db.SaveChangesAsync(ct);
    }
}
