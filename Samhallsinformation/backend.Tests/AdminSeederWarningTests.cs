namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V4-1a (E2#8): admin-seeden får inte hoppa tyst över när ADMIN_EMAIL redan finns med annan roll än Admin.
/// Rollen ändras aldrig automatiskt — bara en tydlig Warning.
/// </summary>
public class AdminSeederWarningTests
{
    private static User Konto(string email, string role) =>
        new() { Name = "x", Email = email, PasswordHash = "hash", Role = role, EmailVerified = true };

    [Theory]
    [InlineData("Användare")]
    [InlineData("Support")]
    public async Task KontoFinnsMedAnnanRoll_LoggarWarning_OchÄndrarInteRollen(string roll)
    {
        using var db = TestDb.Create();
        db.Users.Add(Konto("admin@x.se", roll));
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        var skapad = await AdminSeeder.EnsureAdminAsync(db, "admin@x.se", "seed-losenord", "Adminen", logger);

        Assert.False(skapad);
        var warning = Assert.Single(logger.Messages(LogLevel.Warning));
        Assert.Contains("ADMIN_EMAIL pekar på ett konto utan Admin-roll", warning);
        Assert.Contains("ingen admin skapad/uppgraderad", warning);
        var kvar = await db.Users.SingleAsync();
        Assert.Equal(roll, kvar.Role);
        Assert.Equal("hash", kvar.PasswordHash);
    }

    [Fact]
    public async Task KontoFinnsMedAnnanRoll_OchAnnanVersalisering_LoggarÄndå()
    {
        using var db = TestDb.Create();
        db.Users.Add(Konto("Admin@X.se", "Användare"));
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        await AdminSeeder.EnsureAdminAsync(db, " admin@x.se ", "seed-losenord", "Adminen", logger);

        Assert.Single(logger.Messages(LogLevel.Warning));
    }

    [Fact]
    public async Task KontoFinnsRedanSomAdmin_LoggarInteWarning()
    {
        using var db = TestDb.Create();
        db.Users.Add(Konto("admin@x.se", "Admin"));
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        var skapad = await AdminSeeder.EnsureAdminAsync(db, "admin@x.se", "seed-losenord", "Adminen", logger);

        Assert.False(skapad);
        Assert.Empty(logger.Messages(LogLevel.Warning));
    }

    [Fact]
    public async Task NyttAdminKonto_OchSaknadKonfig_LoggarInteWarning()
    {
        using var db = TestDb.Create();
        var logger = new CapturingLogger();

        Assert.True(await AdminSeeder.EnsureAdminAsync(db, "ny@x.se", "seed-losenord", "Adminen", logger));
        Assert.False(await AdminSeeder.EnsureAdminAsync(db, null, "seed-losenord", "Adminen", logger));
        Assert.False(await AdminSeeder.EnsureAdminAsync(db, "annan@x.se", "", "Adminen", logger));

        Assert.Empty(logger.Messages(LogLevel.Warning));
    }

    [Fact]
    public async Task UtanLogger_KastarInte_NärKontotHarAnnanRoll()
    {
        using var db = TestDb.Create();
        db.Users.Add(Konto("admin@x.se", "Användare"));
        await db.SaveChangesAsync();

        Assert.False(await AdminSeeder.EnsureAdminAsync(db, "admin@x.se", "seed-losenord", "Adminen"));
    }
}
