namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

// Kör faktisk GDPR-anonymisering av konton vars 24h-ångerfönster
// (User.DeletionScheduledAt, satt av AdminUsersController.Delete) har gått ut.
// Kontot spärras redan omedelbart när raderingen begärs — den här tjänsten
// gör bara den slutgiltiga, irreversibla anonymiseringen efter fönstret.
public class UserDeletionBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UserDeletionBackgroundService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    public UserDeletionBackgroundService(IServiceScopeFactory scopeFactory, ILogger<UserDeletionBackgroundService> logger)
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
                await ExecuteDueDeletionsAsync(db, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UserDeletionBackgroundService misslyckades — försöker igen om {Interval}", _interval);
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    public static async Task ExecuteDueDeletionsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await db.Users
            .Where(u => u.DeletionScheduledAt != null && u.DeletionScheduledAt <= now && u.DeletedAt == null)
            .ToListAsync(ct);

        foreach (var user in due)
        {
            user.Name                   = "Raderad användare";
            user.Email                  = $"deleted-{Guid.NewGuid():N}@anonymized.local";
            user.PasswordHash           = "";
            user.Role                   = "Användare";
            user.IsActive               = false;
            user.SuspendedReason        = "Konto raderat (GDPR)";
            user.SuspensionReminderAt   = null;
            user.SuspensionReminderNote = null;
            user.DeletionScheduledAt    = null;
            user.DeletedAt              = now;
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
