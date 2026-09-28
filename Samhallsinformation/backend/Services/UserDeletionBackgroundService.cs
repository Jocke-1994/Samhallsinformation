namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;

// Kör faktisk GDPR-anonymisering av konton vars 24h-ångerfönster
// (User.DeletionScheduledAt, satt av AuthController.DeleteMe / AdminUsersController.Delete)
// har gått ut. Kontot spärras redan omedelbart när raderingen begärs — den här tjänsten
// gör bara den slutgiltiga, irreversibla anonymiseringen efter fönstret. Själva arbetet
// (User-raden + alla tabeller med persondata) ligger i UserAnonymizer.
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
                await ExecuteDueDeletionsAsync(db, stoppingToken, _logger);
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

    // Returnerar antalet konton som anonymiserades. Varje konto körs i sin egen transaktion
    // (UserAnonymizer): ett fel för ett konto rullar tillbaka just det kontot (DeletedAt sätts inte,
    // så det försöks igen nästa cykel) och stoppar varken övriga konton eller bakgrundstjänsten.
    public static async Task<int> ExecuteDueDeletionsAsync(AppDbContext db, CancellationToken ct = default, ILogger? logger = null)
    {
        var now = DateTime.UtcNow;
        var dueIds = await db.Users
            .Where(u => u.DeletionScheduledAt != null && u.DeletionScheduledAt <= now && u.DeletedAt == null)
            .Select(u => u.Id)
            .ToListAsync(ct);

        var done = 0;
        foreach (var id in dueIds)
        {
            try
            {
                await UserAnonymizer.AnonymizeAsync(db, id, now, ct);
                done++;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "GDPR-anonymisering av användare {UserId} misslyckades — allt för kontot rullades tillbaka, försöker igen nästa cykel", id);
            }
        }
        return done;
    }
}
