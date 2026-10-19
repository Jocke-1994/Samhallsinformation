namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// Minimal IWebHostEnvironment-dubbel — bara ContentRootPath används
// (av TestCatalog.Load). Pekar som standard mot en tom, nyskapad
// temp-mapp utan test-catalog.json, så TestCatalog.Load returnerar en
// tom katalog om inte testet skriver en egen fil dit (se MedKatalog).
file sealed class FakeWebHostEnvironment : IWebHostEnvironment
{
    public string ContentRootPath { get; set; } = Directory.CreateTempSubdirectory().FullName;
    public string EnvironmentName { get; set; } = "Test";
    public string ApplicationName { get; set; } = "Samhallsinformation.Tests";
    public string WebRootPath { get; set; } = "";
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
}

public class AdminFeatureIdeaControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static ClaimsPrincipal Authenticated(Guid userId) => new(
        new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth"));

    private static AdminFeatureIdeaController NewController(AppDbContext db, Guid adminId) => new(db, new FakeWebHostEnvironment())
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = Authenticated(adminId) } },
    };

    // Skriver en liten, egen test-catalog.json i en temp-mapp och returnerar
    // en controller vars TestCatalog.Load läser just den — isolerad från
    // repots riktiga katalog och från andra tester.
    private static AdminFeatureIdeaController NewControllerMedKatalog(AppDbContext db, Guid adminId, string json)
    {
        var dir = Directory.CreateTempSubdirectory().FullName;
        Directory.CreateDirectory(Path.Combine(dir, "Data"));
        File.WriteAllText(Path.Combine(dir, "Data", "test-catalog.json"), json);
        return new AdminFeatureIdeaController(db, new FakeWebHostEnvironment { ContentRootPath = dir })
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = Authenticated(adminId) } },
        };
    }

    private static async Task<User> NewAdmin(AppDbContext db)
    {
        var admin = new User { Name = "Joakim", Email = "admin@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        return admin;
    }

    [Fact]
    public async Task CreateIdea_AssignsIncrementingIdeaNumber()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var controller = NewController(db, admin.Id);

        await controller.CreateIdea(new CreateFeatureIdeaRequest("Första idén", null, null, null));
        await controller.CreateIdea(new CreateFeatureIdeaRequest("Andra idén", null, null, null));

        var numbers = db.FeatureIdeas.OrderBy(i => i.CreatedAt).Select(i => i.IdeaNumber).ToList();
        Assert.Equal([1, 2], numbers);
    }

    [Fact]
    public async Task CreateIdea_WithoutTitle_ReturnsBadRequest()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var controller = NewController(db, admin.Id);

        var result = await controller.CreateIdea(new CreateFeatureIdeaRequest("", null, null, null));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.FeatureIdeas);
    }

    [Fact]
    public async Task CreateIdea_DefaultsToBrainstormStageAndAdminSource()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var controller = NewController(db, admin.Id);

        await controller.CreateIdea(new CreateFeatureIdeaRequest("En idé", "Beskrivning", null, null));

        var idea = Assert.Single(db.FeatureIdeas);
        Assert.Equal("brainstorm", idea.Stage);
        Assert.Equal("admin", idea.KällaTyp);
        Assert.Equal(admin.Id, idea.CreatedByUserId);
    }

    [Fact]
    public async Task CreateIdea_AssignsLowestPriorityLast()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var controller = NewController(db, admin.Id);

        await controller.CreateIdea(new CreateFeatureIdeaRequest("Första idén", null, null, null));
        await controller.CreateIdea(new CreateFeatureIdeaRequest("Andra idén", null, null, null));

        var priorities = db.FeatureIdeas.OrderBy(i => i.CreatedAt).Select(i => i.Priority).ToList();
        Assert.Equal([0, 1], priorities);
    }

    [Fact]
    public async Task Reorder_SetsPriorityFromRequestedOrder()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var a = new FeatureIdea { IdeaNumber = 1, Title = "A", CreatedByUserId = admin.Id, Priority = 0 };
        var b = new FeatureIdea { IdeaNumber = 2, Title = "B", CreatedByUserId = admin.Id, Priority = 1 };
        var c = new FeatureIdea { IdeaNumber = 3, Title = "C", CreatedByUserId = admin.Id, Priority = 2 };
        db.FeatureIdeas.AddRange(a, b, c);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        var result = await controller.Reorder(new ReorderFeatureIdeasRequest([c.Id, a.Id, b.Id]));

        Assert.IsType<OkResult>(result);
        Assert.Equal(0, (await db.FeatureIdeas.FindAsync(c.Id))!.Priority);
        Assert.Equal(1, (await db.FeatureIdeas.FindAsync(a.Id))!.Priority);
        Assert.Equal(2, (await db.FeatureIdeas.FindAsync(b.Id))!.Priority);
    }

    [Fact]
    public async Task Reorder_MissingAnIdea_ReturnsBadRequestAndChangesNothing()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var a = new FeatureIdea { IdeaNumber = 1, Title = "A", CreatedByUserId = admin.Id, Priority = 0 };
        var b = new FeatureIdea { IdeaNumber = 2, Title = "B", CreatedByUserId = admin.Id, Priority = 1 };
        db.FeatureIdeas.AddRange(a, b);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        var result = await controller.Reorder(new ReorderFeatureIdeasRequest([a.Id]));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, (await db.FeatureIdeas.FindAsync(a.Id))!.Priority);
        Assert.Equal(1, (await db.FeatureIdeas.FindAsync(b.Id))!.Priority);
    }

    [Fact]
    public async Task Reorder_UnknownId_ReturnsBadRequest()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var a = new FeatureIdea { IdeaNumber = 1, Title = "A", CreatedByUserId = admin.Id, Priority = 0 };
        db.FeatureIdeas.Add(a);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        var result = await controller.Reorder(new ReorderFeatureIdeasRequest([Guid.NewGuid()]));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SetTriage_SetsAllThreeFields()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.SetTriage(idea.Id, new SetTriageRequest(true, false, "Kan göras men prioriteras inte just nu"));

        var updated = await db.FeatureIdeas.FindAsync(idea.Id);
        Assert.True(updated!.TriageKanGoras);
        Assert.False(updated.TriageBorGoras);
        Assert.Equal("Kan göras men prioriteras inte just nu", updated.TriageMotivering);
    }

    [Fact]
    public async Task SetStage_ToLanseringsklar_SeedsDefaultChecklist()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id, Stage = "testas" };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));

        var checklist = db.FeatureIdeaChecklistItems.Where(c => c.FeatureIdeaId == idea.Id).ToList();
        Assert.Equal(4, checklist.Count);
        Assert.All(checklist, c => Assert.False(c.Done));
    }

    [Fact]
    public async Task SetStage_ToLanseringsklarTwice_DoesNotDuplicateChecklist()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id, Stage = "testas" };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));
        await controller.SetStage(idea.Id, new SetStageRequest("byggs"));
        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));

        var checklist = db.FeatureIdeaChecklistItems.Where(c => c.FeatureIdeaId == idea.Id).ToList();
        Assert.Equal(4, checklist.Count);
    }

    [Fact]
    public async Task AddTester_WithKnownEmail_LinksRealUser()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var tester = new User { Name = "Tess Tare", Email = "tess@example.com", PasswordHash = "x" };
        db.Users.Add(tester);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        var result = await controller.AddTester(idea.Id, new AddTesterRequest("tess@example.com"));

        Assert.IsType<OkObjectResult>(result);
        var link = Assert.Single(db.FeatureIdeaTesters);
        Assert.Equal(tester.Id, link.UserId);
    }

    [Fact]
    public async Task AddTester_WithUnknownEmail_ReturnsNotFound()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        var result = await controller.AddTester(idea.Id, new AddTesterRequest("okand@example.com"));

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Empty(db.FeatureIdeaTesters);
    }

    [Fact]
    public async Task AddTester_AlreadyAdded_ReturnsConflict()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var tester = new User { Name = "Tess", Email = "tess@example.com", PasswordHash = "x" };
        db.Users.Add(tester);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);
        await controller.AddTester(idea.Id, new AddTesterRequest("tess@example.com"));

        var result = await controller.AddTester(idea.Id, new AddTesterRequest("tess@example.com"));

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(db.FeatureIdeaTesters);
    }

    [Fact]
    public async Task RemoveTester_RemovesLink()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var tester = new User { Name = "Tess", Email = "tess@example.com", PasswordHash = "x" };
        db.Users.Add(tester);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);
        await controller.AddTester(idea.Id, new AddTesterRequest("tess@example.com"));

        await controller.RemoveTester(idea.Id, tester.Id);

        Assert.Empty(db.FeatureIdeaTesters);
    }

    [Fact]
    public async Task ChecklistItem_ToggleDone_SetsDoneAtAndDoneBy()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);
        var addResult = Assert.IsType<OkObjectResult>(await controller.AddChecklistItem(idea.Id, new AddChecklistItemRequest("FAQ uppdaterad", null)));
        var itemId = (Guid)addResult.Value!.GetType().GetProperty("Id")!.GetValue(addResult.Value)!;

        await controller.ToggleChecklistItem(idea.Id, itemId, new ToggleChecklistItemRequest(true));

        var item = await db.FeatureIdeaChecklistItems.FindAsync(itemId);
        Assert.True(item!.Done);
        Assert.NotNull(item.DoneAt);
        Assert.Equal(admin.Id, item.DoneByUserId);
    }

    [Fact]
    public async Task AddChecklistItem_DefaultsToLanseringFas()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.AddChecklistItem(idea.Id, new AddChecklistItemRequest("FAQ uppdaterad", null));

        var item = Assert.Single(db.FeatureIdeaChecklistItems);
        Assert.Equal("lansering", item.Fas);
    }

    [Fact]
    public async Task AddChecklistItem_FasTestning_SparasSomTestning()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.AddChecklistItem(idea.Id, new AddChecklistItemRequest("Testa på mobil", "testning"));

        var item = Assert.Single(db.FeatureIdeaChecklistItems);
        Assert.Equal("testning", item.Fas);
    }

    [Fact]
    public async Task AddChecklistItem_OkäntFasVärde_FallerTillbakaPåLansering()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.AddChecklistItem(idea.Id, new AddChecklistItemRequest("Punkt", "nåt-okänt"));

        var item = Assert.Single(db.FeatureIdeaChecklistItems);
        Assert.Equal("lansering", item.Fas);
    }

    private const string ExempelKatalog = """
        {
          "generatedAt": "2026-10-19T00:00:00Z",
          "backendTotal": 7,
          "frontendTotal": 0,
          "files": [
            {
              "path": "backend.Tests/PlatsMatchareTests.cs",
              "className": "PlatsMatchareTests",
              "project": "backend",
              "count": 7,
              "names": ["Matcha_KändaRiktigaPolisenVärden_GerRättTräff", "Matcha_SmhiFritext_ReturnerarNullAldrigKrasch"]
            }
          ]
        }
        """;

    [Fact]
    public async Task AddTestFile_KäntSökväg_LäggsTill()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewControllerMedKatalog(db, admin.Id, ExempelKatalog);

        var result = await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PlatsMatchareTests.cs"));

        Assert.IsType<OkResult>(result);
        var rad = Assert.Single(db.FeatureIdeaTestFiles);
        Assert.Equal("backend.Tests/PlatsMatchareTests.cs", rad.FilePath);
    }

    [Fact]
    public async Task AddTestFile_OkändSökväg_ReturnerarBadRequest()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewControllerMedKatalog(db, admin.Id, ExempelKatalog);

        var result = await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PåhittadFil.cs"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.FeatureIdeaTestFiles);
    }

    [Fact]
    public async Task AddTestFile_RedanKopplad_ReturnerarConflict()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewControllerMedKatalog(db, admin.Id, ExempelKatalog);
        await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PlatsMatchareTests.cs"));

        var result = await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PlatsMatchareTests.cs"));

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(db.FeatureIdeaTestFiles);
    }

    [Fact]
    public async Task RemoveTestFile_TarBortRad()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewControllerMedKatalog(db, admin.Id, ExempelKatalog);
        await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PlatsMatchareTests.cs"));
        var testFileId = db.FeatureIdeaTestFiles.Single().Id;

        var result = await controller.RemoveTestFile(idea.Id, testFileId);

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.FeatureIdeaTestFiles);
    }

    [Fact]
    public async Task GetIdea_InnehållerTestFilerMedAntalFrånKatalogen()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewControllerMedKatalog(db, admin.Id, ExempelKatalog);
        await controller.AddTestFile(idea.Id, new AddTestFileRequest("backend.Tests/PlatsMatchareTests.cs"));

        var result = Assert.IsType<OkObjectResult>(await controller.GetIdea(idea.Id));
        var testFiles = (System.Collections.IEnumerable)result.Value!.GetType().GetProperty("TestFiles")!.GetValue(result.Value)!;
        var rad = testFiles.Cast<object>().Single();
        var antal = (int)rad.GetType().GetProperty("Count")!.GetValue(rad)!;

        Assert.Equal(7, antal);
    }

    [Fact]
    public async Task ChecklistItem_Remove_DeletesItem()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);
        var addResult = Assert.IsType<OkObjectResult>(await controller.AddChecklistItem(idea.Id, new AddChecklistItemRequest("Eget item", null)));
        var itemId = (Guid)addResult.Value!.GetType().GetProperty("Id")!.GetValue(addResult.Value)!;

        await controller.RemoveChecklistItem(idea.Id, itemId);

        Assert.Empty(db.FeatureIdeaChecklistItems);
    }

    [Fact]
    public void AdminFeatureIdeaController_RequiresAdminRole()
    {
        var attr = typeof(AdminFeatureIdeaController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin", attr!.Roles);
    }

    [Fact]
    public async Task SetStage_ReClickingSameStage_DoesNotResetRedoAttLanseras()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id, FlagKey = "kallor_lan_filter" };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));
        db.FeatureFlagOverrides.Single().RedoAttLanseras = false; // admin ångrar sig manuellt
        await db.SaveChangesAsync();

        // Omklick på samma, redan valda stadium — ska INTE återställa flaggan.
        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));

        Assert.False(db.FeatureFlagOverrides.Single().RedoAttLanseras);
    }

    [Fact]
    public async Task SetStage_DemotedFromLanseringsklar_ClearsRedoAttLanseras()
    {
        using var db = NewDb();
        var admin = await NewAdmin(db);
        var idea = new FeatureIdea { IdeaNumber = 1, Title = "Idé", CreatedByUserId = admin.Id, FlagKey = "kallor_lan_filter" };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        var controller = NewController(db, admin.Id);

        await controller.SetStage(idea.Id, new SetStageRequest("lanseringsklar"));
        Assert.True(db.FeatureFlagOverrides.Single().RedoAttLanseras);

        await controller.SetStage(idea.Id, new SetStageRequest("byggs"));

        Assert.False(db.FeatureFlagOverrides.Single().RedoAttLanseras);
    }
}
