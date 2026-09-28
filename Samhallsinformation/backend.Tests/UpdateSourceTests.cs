namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-21 (E6#15): PATCH /api/admin/sources/{id} är partiell — bara skickade fält ändras.
/// Kontraktet frontend nu bygger på: ett delta utan IsPublished/IsActive får aldrig röra dem,
/// så en redigering inte kan skriva över ett läge som ändrats på annat håll.
/// </summary>
public class UpdateSourceTests
{
    private static SourcesController NewController(Data.AppDbContext db)
    {
        var log = new AktivitetsloggService(db, Substitute.For<IHttpContextAccessor>());
        return new SourcesController(db, Array.Empty<IIngestor>(), Substitute.For<IHttpClientFactory>(), log);
    }

    private static Source AddSource(Data.AppDbContext db, bool isActive, bool isPublished)
    {
        var s = new Source
        {
            Name = "Gammalt namn", ShortName = "GN", BaseUrl = "https://rss.test", Url = "https://rss.test/feed",
            Category = "Nationell", Type = SourceType.RSS, IsActive = isActive, IsPublished = isPublished,
        };
        db.Sources.Add(s);
        db.SaveChanges();
        return s;
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Patch_RedigeringsDelta_BevararIsPublishedOchIsActive(bool isActive, bool isPublished)
    {
        using var db = TestDb.Create();
        var src = AddSource(db, isActive, isPublished);

        var result = await NewController(db).UpdateSource(src.Id,
            new UpdateSourceRequest("Nytt namn", null, "https://rss.test/ny", "Regional", null, null));

        Assert.IsType<OkObjectResult>(result);
        var sparad = await db.Sources.AsNoTracking().SingleAsync();
        Assert.Equal("Nytt namn", sparad.Name);
        Assert.Equal("https://rss.test/ny", sparad.Url);
        Assert.Equal("Regional", sparad.Category);
        Assert.Equal("GN", sparad.ShortName);
        Assert.Equal(isActive, sparad.IsActive);
        Assert.Equal(isPublished, sparad.IsPublished);
    }

    [Fact]
    public async Task Patch_BaraIsPublished_AndrarInteNamnUrlKategoriEllerIsActive()
    {
        using var db = TestDb.Create();
        var src = AddSource(db, isActive: true, isPublished: false);

        await NewController(db).UpdateSource(src.Id, new UpdateSourceRequest(null, null, null, null, null, true));

        var sparad = await db.Sources.AsNoTracking().SingleAsync();
        Assert.True(sparad.IsPublished);
        Assert.True(sparad.IsActive);
        Assert.Equal("Gammalt namn", sparad.Name);
        Assert.Equal("https://rss.test/feed", sparad.Url);
        Assert.Equal("Nationell", sparad.Category);
    }

    [Fact]
    public async Task Patch_BaraIsActive_AndrarInteIsPublished()
    {
        using var db = TestDb.Create();
        var src = AddSource(db, isActive: true, isPublished: false);

        await NewController(db).UpdateSource(src.Id, new UpdateSourceRequest(null, null, null, null, false, null));

        var sparad = await db.Sources.AsNoTracking().SingleAsync();
        Assert.False(sparad.IsActive);
        Assert.False(sparad.IsPublished);
    }
}
