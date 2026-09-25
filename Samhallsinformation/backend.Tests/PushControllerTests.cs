namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// Claim-endpointen kör en atomär ExecuteUpdate, som EF Cores InMemory-provider inte
// stöder — därför riktig SQLite (TestDb) här.
public class PushControllerTests
{
    private static PushController NewController(AppDbContext db) =>
        new(db, Substitute.For<IConfiguration>(), Substitute.For<IPushNotificationService>(), Substitute.For<IAktivitetsloggService>());

    private static bool Claimed(IActionResult result)
    {
        var value = Assert.IsType<OkObjectResult>(result).Value!;
        return (bool)value.GetType().GetProperty("claimed")!.GetValue(value)!;
    }

    internal static UserDevice SeedDevice(AppDbContext db, string endpoint = "https://push.example/ep")
    {
        var user = new User { Name = "Ada", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.SaveChanges();
        var device = new UserDevice { UserId = user.Id, Endpoint = endpoint, P256dh = "p", Auth = "a" };
        db.UserDevices.Add(device);
        db.SaveChanges();
        return device;
    }

    [Fact]
    public async Task Claim_FirstDevice_ClaimsSuccessfully()
    {
        using var db = TestDb.Create();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid() };
        db.PushDispatchClaims.Add(claim);
        await db.SaveChangesAsync();
        var deviceId = Guid.NewGuid();

        var result = await NewController(db).Claim(new ClaimRequest(claim.Id, deviceId));

        Assert.True(Claimed(result));
        using var check = TestDb.CreateSecondContext(db);
        var updated = await check.PushDispatchClaims.SingleAsync();
        Assert.NotNull(updated.ClaimedAt);
        Assert.Equal(deviceId, updated.ClaimedByDeviceId);
    }

    [Fact]
    public async Task Claim_AlreadyClaimedBySomeoneElse_ReturnsFalse()
    {
        using var db = TestDb.Create();
        var first = Guid.NewGuid();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid(), ClaimedAt = DateTime.UtcNow, ClaimedByDeviceId = first };
        db.PushDispatchClaims.Add(claim);
        await db.SaveChangesAsync();

        var result = await NewController(db).Claim(new ClaimRequest(claim.Id, Guid.NewGuid()));

        Assert.False(Claimed(result));
        using var check = TestDb.CreateSecondContext(db);
        Assert.Equal(first, (await check.PushDispatchClaims.SingleAsync()).ClaimedByDeviceId); // vinnaren skrivs inte över
    }

    [Fact]
    public async Task Claim_SecondDeviceAfterFirst_ReturnsFalse()
    {
        using var db = TestDb.Create();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid() };
        db.PushDispatchClaims.Add(claim);
        await db.SaveChangesAsync();
        var controller = NewController(db);

        var first  = await controller.Claim(new ClaimRequest(claim.Id, Guid.NewGuid()));
        var second = await controller.Claim(new ClaimRequest(claim.Id, Guid.NewGuid()));

        Assert.True(Claimed(first));
        Assert.False(Claimed(second));
    }

    // Ersätter Claim_UnknownClaimId_FailsOpenAsClaimed, som låste fast att ett okänt id
    // ALLTID gav claimed:true — det var själva dedup-hålet (varje enhet fick true).
    // Nu: en registrerad enhet får raden skapad åt sig (den första visar notisen, resten
    // får false), så vi varken förlorar notisen eller dubblerar den.
    [Fact]
    public async Task Claim_UnknownClaimId_KnownDevice_FirstClaimsAndRowIsCreated_SecondGetsFalse()
    {
        using var db = TestDb.Create();
        var d1 = SeedDevice(db, "https://push.example/ep1");
        var d2 = SeedDevice(db, "https://push.example/ep2");
        var unknownClaimId = Guid.NewGuid();
        var controller = NewController(db);

        var first  = await controller.Claim(new ClaimRequest(unknownClaimId, d1.Id));
        var second = await controller.Claim(new ClaimRequest(unknownClaimId, d2.Id));

        Assert.True(Claimed(first));
        Assert.False(Claimed(second));
        using var check = TestDb.CreateSecondContext(db);
        var row = await check.PushDispatchClaims.SingleAsync();
        Assert.Equal(unknownClaimId, row.Id);
        Assert.Equal(d1.Id, row.ClaimedByDeviceId);
        Assert.Equal(d1.UserId, row.UserId);
    }

    // Okänt id OCH okänd enhet: inget att dedupa mot och ingen användare att knyta en rad
    // till (anonymt anrop får inte fylla tabellen) — hellre en notis för mycket: true, ingen rad.
    [Fact]
    public async Task Claim_UnknownClaimId_UnknownDevice_ShowsAndCreatesNothing()
    {
        using var db = TestDb.Create();

        var result = await NewController(db).Claim(new ClaimRequest(Guid.NewGuid(), Guid.NewGuid()));

        Assert.True(Claimed(result));
        Assert.Empty(db.PushDispatchClaims);
    }
}
