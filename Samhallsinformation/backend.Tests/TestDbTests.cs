namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// Bevisar att <see cref="TestDb"/> ger en riktig relationsdatabas — det InMemory-providern inte kan.
/// </summary>
public class TestDbTests
{
    [Fact]
    public async Task SaveChanges_DuplicateUserEmail_ThrowsOnRealUniqueIndex()
    {
        using var db = TestDb.Create();
        db.Users.Add(new User { Email = "dubblett@example.com", Name = "A" });
        await db.SaveChangesAsync();

        db.Users.Add(new User { Email = "dubblett@example.com", Name = "B" });

        // InMemory-providern hade släppt igenom den här raden tyst.
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task SaveChanges_RowPointingAtMissingUser_ThrowsOnForeignKeyAndSchemaIsComplete()
    {
        using var db = TestDb.Create();
        var source = new Source { Name = "Testkälla", ShortName = "Test" };
        db.Sources.Add(source);
        await db.SaveChangesAsync();

        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = Guid.NewGuid(), SourceId = source.Id });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());

        // Schemat är skapat på riktigt: en andra kontext mot samma databas ser Source-raden men inte den nekade raden.
        using var second = TestDb.CreateSecondContext(db);
        Assert.Equal(1, await second.Sources.CountAsync());
        Assert.Equal(0, await second.UserSourcePreferences.CountAsync());
    }
}
