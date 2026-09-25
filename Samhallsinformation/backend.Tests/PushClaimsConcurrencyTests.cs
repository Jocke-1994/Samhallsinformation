namespace Samhallsinformation.Tests;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Push;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// Riktigt samtidiga claims: en SQLite-FIL med en egen anslutning/kontext per anrop
// (en delad in-memory-anslutning kan inte användas från flera trådar samtidigt).
public class PushClaimsConcurrencyTests : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), $"claims-{Guid.NewGuid():N}.db");

    private AppDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={_path};Default Timeout=30")
            .Options;
        return new AppDbContext(options);
    }

    private AppDbContext CreateDb()
    {
        var db = NewContext();
        db.Database.EnsureCreated();
        return db;
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        try { File.Delete(_path); } catch { /* bäst-ansträngning */ }
    }

    private async Task<bool[]> ClaimConcurrentlyAsync(Guid claimId, IReadOnlyList<Guid> deviceIds)
    {
        using var gate = new ManualResetEventSlim(false);
        var tasks = deviceIds.Select(deviceId => Task.Run(async () =>
        {
            using var ctx = NewContext();
            gate.Wait();
            return await PushClaims.TryClaimAsync(ctx, claimId, deviceId);
        })).ToArray();
        gate.Set();
        return await Task.WhenAll(tasks);
    }

    [Fact]
    public async Task ConcurrentClaims_OnExistingRow_ExactlyOneWins()
    {
        using var setup = CreateDb();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid() };
        setup.PushDispatchClaims.Add(claim);
        await setup.SaveChangesAsync();

        var results = await ClaimConcurrentlyAsync(claim.Id, Enumerable.Range(0, 8).Select(_ => Guid.NewGuid()).ToList());

        Assert.Equal(1, results.Count(r => r));
        Assert.Equal(7, results.Count(r => !r));
    }

    [Fact]
    public async Task ConcurrentClaims_OnUnknownId_WithRegisteredDevices_ExactlyOneWins()
    {
        using var setup = CreateDb();
        var user = new User { Name = "Ada", Email = "a@example.com", PasswordHash = "x" };
        setup.Users.Add(user);
        await setup.SaveChangesAsync();
        var devices = Enumerable.Range(0, 6).Select(i => new UserDevice { UserId = user.Id, Endpoint = $"https://push.example/{i}", P256dh = "p", Auth = "a" }).ToList();
        setup.UserDevices.AddRange(devices);
        await setup.SaveChangesAsync();

        var results = await ClaimConcurrentlyAsync(Guid.NewGuid(), devices.Select(d => d.Id).ToList());

        Assert.Equal(1, results.Count(r => r));
        Assert.Single(setup.PushDispatchClaims.AsNoTracking().ToList());
    }
}
