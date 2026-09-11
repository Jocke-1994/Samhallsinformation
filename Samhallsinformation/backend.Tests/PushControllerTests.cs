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

public class PushControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static PushController NewController(AppDbContext db) =>
        new(db, Substitute.For<IConfiguration>(), Substitute.For<IPushNotificationService>(), Substitute.For<IAktivitetsloggService>());

    private static bool Claimed(IActionResult result)
    {
        var value = Assert.IsType<OkObjectResult>(result).Value!;
        return (bool)value.GetType().GetProperty("claimed")!.GetValue(value)!;
    }

    [Fact]
    public async Task Claim_FirstDevice_ClaimsSuccessfully()
    {
        using var db = NewDb();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid() };
        db.PushDispatchClaims.Add(claim);
        await db.SaveChangesAsync();
        var controller = NewController(db);

        var result = await controller.Claim(new ClaimRequest(claim.Id, Guid.NewGuid()));

        Assert.True(Claimed(result));
        var updated = await db.PushDispatchClaims.SingleAsync();
        Assert.NotNull(updated.ClaimedAt);
    }

    [Fact]
    public async Task Claim_AlreadyClaimedBySomeoneElse_ReturnsFalse()
    {
        using var db = NewDb();
        var claim = new PushDispatchClaim { UserId = Guid.NewGuid(), ClaimedAt = DateTime.UtcNow, ClaimedByDeviceId = Guid.NewGuid() };
        db.PushDispatchClaims.Add(claim);
        await db.SaveChangesAsync();
        var controller = NewController(db);

        var result = await controller.Claim(new ClaimRequest(claim.Id, Guid.NewGuid()));

        Assert.False(Claimed(result));
    }

    // Ett okänt claimId (redan städat bort, eller ett ID som aldrig fanns)
    // ska fail-open — hellre en extra notis än att en riktig händelse aldrig
    // visas någonstans om claim-raden av någon anledning saknas.
    [Fact]
    public async Task Claim_UnknownClaimId_FailsOpenAsClaimed()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.Claim(new ClaimRequest(Guid.NewGuid(), Guid.NewGuid()));

        Assert.True(Claimed(result));
    }
}
