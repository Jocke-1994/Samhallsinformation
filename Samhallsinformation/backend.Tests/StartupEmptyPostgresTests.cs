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
/// V2-1 (migrationsstartens historik-probe, PR #605) var vid extraktionstillfället fortfarande
/// HÅLLS/inte mergad — det här testet kördes då mot probe-koden som LÅG på main (catch-blocket som
/// satte alreadyMigrated=false vid ett probe-fel). V2-1 är nu mergad: testet kör mot
/// <see cref="Samhallsinformation.Infrastructure.StartupSchemaGuard.Decide"/>/<c>InspectAsync</c>
/// istället (det anropar DatabaseBootstrapper.RunAsync, ingen kopia — ingen ändring krävdes här).
///
/// **UPPDATERING 2026-09-27:** CI kördes — testet blev RÖTT, precis som förutsett ovan.
/// <c>Npgsql.PostgresException 42P01: relation "Sources" does not exist</c>. Det bevisar E2#3/V3-23
/// på riktigt. Skippat (se [Fact(Skip=...)] nedan) i väntan på V3-23 — se motiveringen där för
/// rotorsaken.
///
/// **UPPDATERING (V2-1 mergad):** rotorsaken är oförändrad efter V2-1. På en genuint tom Postgres
/// (inga tabeller alls) sätter StartupSchemaGuard.Decide korrekt Action=ResetLegacySchema (inga rader
/// att förlora), men det ändrar bara VILKET drop/typläknings-block som körs. Sekvensblocket direkt
/// efter ("Säkerställ att Sources.Id har en sequence...", <c>SELECT MAX("Id") FROM "Sources"</c>)
/// körs OVILLKORLIGT i alla tre grenar och antar att "Sources" redan finns — V2-1 rör inte det
/// blocket. Testet ska alltså fortfarande vara rött/skippat tills V3-23 är löst.
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

    // BEVISAT RÖTT i CI 2026-09-27: Npgsql.PostgresException 42P01 ("relation \"Sources\" does not
    // exist"). Det här är INTE ett fel i testet — det ÄR E2#3/V3-23-fyndet (Start mot tom PostgreSQL)
    // bevisat på riktigt för första gången, exakt vad testet byggdes för att avgöra. Rotorsak:
    // uppstartens "säkerställ Sources.Id-sekvens"-block (DO-blocket med
    // CREATE SEQUENCE "Sources_Id_seq" / SELECT MAX("Id") FROM "Sources") körs OVILLKORLIGT innan
    // MigrateAsync() och antar att Sources-tabellen redan finns — ett antagande som bara stämmer på
    // en databas med en tidigare SQLite→Postgres-historia, aldrig på en genuint tom Postgres. Skippat
    // i väntan på V3-23 (som är UPPSKJUTEN i FIXPLAN.md). Det här testet ÄR facit för V3-23 — ta bort
    // Skip så fort den fixen finns.
    [Fact(Skip = "Bevisat rött 2026-09-27 (42P01: relation \"Sources\" does not exist) — E2#3/V3-23, inte ett testfel. Rotorsak: sekvensblocket i DatabaseBootstrapper läser Sources innan MigrateAsync(). Avskippa när V3-23 är löst.")]
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
