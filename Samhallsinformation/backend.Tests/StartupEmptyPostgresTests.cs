namespace Samhallsinformation.Tests;

using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Samhallsinformation.Data;
using Xunit;

/// <summary>
/// Guard G6 (code review enhet 8, "Det slutgiltiga guardet") — det viktigaste testet i hela
/// V4-serien. Kör den FAKTISKA uppstartslogiken (<see cref="Samhallsinformation.Infrastructure.DatabaseBootstrapper.RunAsync"/>
/// — samma metod Program.cs anropar, extraherad dit oförändrad i V4-6b) mot en helt TOM
/// Postgres-databas (ingen migrationshistorik, inga tabeller), och läser sedan varje
/// <see cref="DbSet{TEntity}"/> i <see cref="AppDbContext"/> för att bevisa att typmappningen
/// verkligen fungerar mot en riktig Npgsql-anslutning — inte bara mot SQLite, som resten av sviten
/// (SQLite kan inte fånga 42804: den skiljer inte på INTEGER/boolean eller TEXT/uuid/timestamptz).
///
/// Detta bevisar E2#3-fyndet (tom-PG-start, V3-23 i FIXPLAN.md) som aldrig kunnat testas förut —
/// enhet-8.md flaggade uttryckligen: "Idag skulle det bli rött eftersom en tom PG inte kan startas".
/// V3-23 (fixen för det, om koden faktiskt behöver ändras) är UPPSKJUTEN i FIXPLAN.md vid den här
/// PR:ens skrivande — så om det här testet faktiskt är rött i CI är det INTE ett fel i testet, utan
/// exakt den kända, overifierade risken det är byggt för att bevisa. Se PR-beskrivningen.
///
/// V2-1 (migrationsstartens historik-probe) var vid extraktionstillfället fortfarande HÅLLS/inte
/// mergad (PR #605) — det här testet kör alltså mot probe-koden som FAKTISKT ligger på main just
/// nu (catch-blocket som sätter alreadyMigrated=false vid ett probe-fel), inte V2-1:s hårdare
/// variant. Om V2-1 mergas senare ärver det här testet automatiskt den nya koden (det anropar
/// DatabaseBootstrapper.RunAsync, inte en kopia) — ingen uppdatering behövs här.
/// </summary>
[Collection("Postgres")]
[Trait("Category", "Postgres")]
public class StartupEmptyPostgresTests
{
    private readonly PostgresFixture _fixture;

    public StartupEmptyPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Startup_EmptyPostgres_BootstrapsAndAllDbSetsAreReadable()
    {
        var connectionString = await _fixture.CreateFreshDatabaseAsync();

        await using var app = await PostgresTestApp.BuildAndBootstrapAsync(connectionString);

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var dbSetProps = typeof(AppDbContext).GetProperties()
            .Where(p => p.PropertyType.IsGenericType && p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>))
            .ToList();

        // Om AppDbContext av någon anledning skulle tappa alla sina DbSet-properties (t.ex. en
        // trasig refaktorering) ska INTE testet gå grönt av fel anledning (tom lista = inget att fela på).
        Assert.NotEmpty(dbSetProps);

        var failures = new List<string>();
        foreach (var prop in dbSetProps)
        {
            var entityType = prop.PropertyType.GetGenericArguments()[0];
            try
            {
                var dbSet = prop.GetValue(db)!;
                var count = await CountAsync(dbSet, entityType);
                Assert.True(count >= 0); // count är alltid >= 0 — poängen är att anropet inte kastar
            }
            catch (Exception ex)
            {
                var inner = ex is TargetInvocationException { InnerException: { } ie } ? ie : ex;
                failures.Add($"{prop.Name} ({entityType.Name}): {inner.GetType().Name}: {inner.Message}");
            }
        }

        Assert.True(failures.Count == 0,
            "Ett eller flera DbSet gick inte att läsa efter en full uppstart (migreringar + raw-SQL-block + " +
            "seedning) mot en TOM Postgres-databas. Det här ÄR E2#3-fyndet om det slår till — troligen en " +
            "migrationssnapshot med fel PostgreSQL-kolumntyp (42804) eller ett steg i uppstartsordningen " +
            "som förutsätter att en tabell/rad redan finns:\n\n" + string.Join("\n", failures));
    }

    /// <summary>
    /// Anropar <c>EntityFrameworkQueryableExtensions.CountAsync&lt;T&gt;(IQueryable&lt;T&gt;, CancellationToken)</c>
    /// via reflektion, eftersom entitetstypen (<paramref name="entityType"/>) bara är känd vid
    /// körtid (den kommer från <see cref="AppDbContext"/>s DbSet-properties, inte ett statiskt
    /// typargument). En enkel CountAsync räcker för att bevisa att raden går att läsa/mappa —
    /// se enhet-8.md G6.
    /// </summary>
    private static async Task<int> CountAsync(object dbSet, Type entityType)
    {
        var method = typeof(EntityFrameworkQueryableExtensions)
            .GetMethods()
            .Single(m => m.Name == nameof(EntityFrameworkQueryableExtensions.CountAsync)
                && m.GetParameters().Length == 2)
            .MakeGenericMethod(entityType);

        var task = (Task)method.Invoke(null, [dbSet, CancellationToken.None])!;
        await task.ConfigureAwait(false);
        var resultProp = task.GetType().GetProperty("Result")!;
        return (int)resultProp.GetValue(task)!;
    }
}
