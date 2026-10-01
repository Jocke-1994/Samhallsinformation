namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// Använder SQLite via TestDb (inte InMemory) eftersom bevisen gäller det unika indexet
// (UserId, SourceId) och främmande nyckeln mot Sources — sånt InMemory-providern inte upprätthåller.
public class UserSourcesControllerTests
{
    private static UserSourcesController NewController(AppDbContext db, Guid userId) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth")),
            },
        },
    };

    private static async Task<User> NewUser(AppDbContext db)
    {
        var user = new User { Name = "Test", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<Source> NewSource(AppDbContext db, bool published, string shortName = "K")
    {
        var source = new Source { Name = shortName, ShortName = shortName, BaseUrl = "https://example.com", IsActive = true, IsPublished = published };
        db.Sources.Add(source);
        await db.SaveChangesAsync();
        return source;
    }

    private static string Message(IActionResult result) =>
        Assert.IsType<string>(Assert.IsType<BadRequestObjectResult>(result).Value);

    [Fact]
    public async Task Save_UnknownSourceId_Returns400NamingTheId_AndSavesNothing()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var ok = await NewSource(db, published: true);
        var controller = NewController(db, user.Id);

        var result = await controller.SaveSources(new()
        {
            new(ok.Id, true, 0),
            new(99999, true, 1),
        });

        Assert.Contains("99999", Message(result));
        Assert.Empty(await db.UserSourcePreferences.ToListAsync()); // atomärt: inget sparas
    }

    [Fact]
    public async Task Save_UnpublishedSource_Returns400NamingTheId_AndSavesNothing()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var sandbox = await NewSource(db, published: false, "SMHI");
        var controller = NewController(db, user.Id);

        var result = await controller.SaveSources(new() { new(sandbox.Id, true, 0) });

        Assert.Contains(sandbox.Id.ToString(), Message(result));
        Assert.Empty(await db.UserSourcePreferences.ToListAsync());
    }

    [Fact]
    public async Task Save_DuplicateSourceIdInBody_DoesNotThrow_LastEntryWins()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var source = await NewSource(db, published: true);
        var controller = NewController(db, user.Id);

        var result = await controller.SaveSources(new()
        {
            new(source.Id, true, 0),
            new(source.Id, false, 5),
        });

        Assert.IsType<OkResult>(result);
        var pref = await db.UserSourcePreferences.SingleAsync();
        Assert.False(pref.IsActive);
        Assert.Equal(5, pref.SortOrder);
    }

    [Fact]
    public async Task Save_ValidList_IsSaved_AndUpdatesExisting()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, published: true, "A");
        var b = await NewSource(db, published: true, "B");
        var controller = NewController(db, user.Id);

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(a.Id, true, 0), new(b.Id, true, 1) }));
        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(a.Id, false, 3) }));

        var prefs = await db.UserSourcePreferences.OrderBy(p => p.SourceId).ToListAsync();
        Assert.Equal(2, prefs.Count);
        Assert.False(prefs[0].IsActive);
        Assert.Equal(3, prefs[0].SortOrder);
        Assert.True(prefs[1].IsActive);
    }

    [Fact]
    public async Task Save_EmptyList_ReturnsOk_AndKeepsExistingPrefs()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var source = await NewSource(db, published: true);
        var controller = NewController(db, user.Id);
        await controller.SaveSources(new() { new(source.Id, true, 0) });

        var result = await controller.SaveSources(new());

        Assert.IsType<OkResult>(result);
        Assert.Single(await db.UserSourcePreferences.ToListAsync());
    }

    // Avpublicerad efter att användaren redan prenumererade: användaren måste kunna spara sin lista
    // (Mina källor "Ta bort alla" skickar alla aktiva prefs, även de avpublicerade) och sortera om.
    [Fact]
    public async Task Save_AlreadySavedSourceLaterUnpublished_CanBeDeactivatedAndReordered()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var source = await NewSource(db, published: true);
        var controller = NewController(db, user.Id);
        await controller.SaveSources(new() { new(source.Id, true, 0) });
        source.IsPublished = false;
        await db.SaveChangesAsync();

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(source.Id, true, 4) })); // oförändrat aktiv, ny ordning
        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(source.Id, false, 4) })); // avaktivera

        var pref = await db.UserSourcePreferences.SingleAsync();
        Assert.False(pref.IsActive);
        Assert.Equal(4, pref.SortOrder);
    }

    // ...men att slå PÅ en avpublicerad källa igen (inaktiv -> aktiv) är samma sak som att lägga till en ny.
    [Fact]
    public async Task Save_ReactivatingUnpublishedSource_Returns400()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var source = await NewSource(db, published: true);
        var controller = NewController(db, user.Id);
        await controller.SaveSources(new() { new(source.Id, false, 0) });
        source.IsPublished = false;
        await db.SaveChangesAsync();

        var result = await controller.SaveSources(new() { new(source.Id, true, 0) });

        Assert.Contains(source.Id.ToString(), Message(result));
        Assert.False((await db.UserSourcePreferences.SingleAsync()).IsActive);
    }

    // V4-6: källor som delar ShortName (multi-feed-mönstret, Polisen/Polisen
    // Efterlysningar) visas som EN rad i Aktiva/Alla källor — att lägga till
    // eller ta bort den ena utan den andra skulle osynkronisera dem.

    [Fact]
    public async Task Save_ActivatingOneOfTwoSiblingsWithSameShortName_ActivatesBothSiblings()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var huvudkalla = await NewSource(db, published: true, "Polisen");
        var efterlysningar = await NewSource(db, published: true, "Polisen");
        var controller = NewController(db, user.Id);

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(huvudkalla.Id, true, 0) }));

        var prefs = await db.UserSourcePreferences.ToListAsync();
        Assert.Equal(2, prefs.Count);
        Assert.All(prefs, p => Assert.True(p.IsActive));
        Assert.Contains(prefs, p => p.SourceId == efterlysningar.Id);
    }

    [Fact]
    public async Task Save_DeactivatingOneOfTwoSiblingsWithSameShortName_DeactivatesBothSiblings()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var huvudkalla = await NewSource(db, published: true, "Polisen");
        var efterlysningar = await NewSource(db, published: true, "Polisen");
        var controller = NewController(db, user.Id);
        await controller.SaveSources(new() { new(huvudkalla.Id, true, 0) });

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(huvudkalla.Id, false, 0) }));

        var prefs = await db.UserSourcePreferences.ToListAsync();
        Assert.All(prefs, p => Assert.False(p.IsActive));
        Assert.Contains(prefs, p => p.SourceId == efterlysningar.Id);
    }

    // En opublicerad syskonkälla (t.ex. en ny komplementkälla som ännu inte verifierats
    // leverera data) ska aldrig kunna blockera att huvudkällan går att aktivera.
    [Fact]
    public async Task Save_ActivatingSourceWithUnpublishedSibling_ActivatesOnlyThePublishedOne()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var huvudkalla = await NewSource(db, published: true, "Polisen");
        var opublicerad = await NewSource(db, published: false, "Polisen");
        var controller = NewController(db, user.Id);

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(huvudkalla.Id, true, 0) }));

        var prefs = await db.UserSourcePreferences.ToListAsync();
        var pref = Assert.Single(prefs);
        Assert.Equal(huvudkalla.Id, pref.SourceId);
        Assert.True(pref.IsActive);
    }

    [Fact]
    public async Task Save_SourceWithoutSiblings_UnaffectedByGroupExpansion()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var source = await NewSource(db, published: true, "Krisinformation");
        var controller = NewController(db, user.Id);

        Assert.IsType<OkResult>(await controller.SaveSources(new() { new(source.Id, true, 0) }));

        Assert.Single(await db.UserSourcePreferences.ToListAsync());
    }
}
