namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

public class UserDeletionBackgroundServiceTests
{
    // SQLite via TestDb i stället för InMemory: anonymiseringen körs i en riktig transaktion (V2-14), som InMemory inte stödjer.
    private static AppDbContext NewDb() => TestDb.Create();

    [Fact]
    public async Task ExecuteDueDeletionsAsync_WindowExpired_AnonymizesUser()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada",
            Email = "ada@example.com",
            PasswordHash = "x",
            IsActive = false,
            SuspendedReason = "Radering begärd (GDPR)",
            DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-1),
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("Raderad användare", updated!.Name);
        Assert.NotEqual("ada@example.com", updated.Email);
        Assert.Equal("", updated.PasswordHash);
        Assert.NotNull(updated.DeletedAt);
        Assert.Null(updated.DeletionScheduledAt);
    }

    [Fact]
    public async Task ExecuteDueDeletionsAsync_WindowNotYetExpired_IsSkipped()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada",
            Email = "ada@example.com",
            PasswordHash = "x",
            IsActive = false,
            DeletionScheduledAt = DateTime.UtcNow.AddHours(1),
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("Ada", updated!.Name);
        Assert.Null(updated.DeletedAt);
    }

    [Fact]
    public async Task ExecuteDueDeletionsAsync_AlreadyDeleted_IsSkipped()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Raderad användare",
            Email = "deleted-x@anonymized.local",
            PasswordHash = "",
            IsActive = false,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            DeletionScheduledAt = null,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("Raderad användare", updated!.Name);
    }

    [Fact]
    public async Task ExecuteDueDeletionsAsync_NoScheduledDeletions_DoesNothing()
    {
        using var db = NewDb();
        db.Users.Add(new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" });
        await db.SaveChangesAsync();

        await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);

        Assert.Equal("Ada", db.Users.Single().Name);
    }
}
