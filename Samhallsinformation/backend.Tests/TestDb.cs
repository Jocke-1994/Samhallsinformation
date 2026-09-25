namespace Samhallsinformation.Tests;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>
/// Delad testhjälpare som skapar en RIKTIG relationsdatabas (SQLite in-memory) med hela
/// <see cref="AppDbContext"/>-schemat. Använd den när ett test måste bevisa något som
/// EF Cores InMemory-provider inte kan: unika index, främmande nycklar/kaskader och fel
/// vid <c>SaveChanges</c> (<see cref="DbUpdateException"/>).
///
/// Befintliga tester använder <c>UseInMemoryDatabase</c> (snabbt, räcker för ren affärslogik)
/// och rörs inte av den här klassen.
///
/// Livscykel: kontexten äger sin anslutning. En SQLite in-memory-databas lever bara så länge
/// anslutningen är öppen, så <see cref="Create"/> öppnar den explicit och den stängs och
/// slängs när kontexten disponeras (<c>using var db = TestDb.Create();</c>).
/// </summary>
public static class TestDb
{
    /// <summary>
    /// Ny, tom databas med hela schemat skapat via <c>EnsureCreated</c> (modellen, inte
    /// migrationerna — migrationerna är SQLite/Postgres-blandade och testas inte här).
    /// Främmande nycklar är påslagna (EF Core kör <c>PRAGMA foreign_keys=ON</c> vid öppning).
    /// </summary>
    /// <param name="kindGuard">Valfri <see cref="DateTimeKindGuard"/> som fångar DateTime-parametrar med
    /// Kind != Utc (härmar Npgsqls timestamptz-regel).</param>
    public static AppDbContext Create(DateTimeKindGuard? kindGuard = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:");
        if (kindGuard != null) builder.AddInterceptors(kindGuard);
        var options = builder.Options;

        var db = new AppDbContext(options);
        try
        {
            // Explicit öppning = anslutningen (och därmed databasen) lever tills kontexten disponeras.
            db.Database.OpenConnection();
            db.Database.EnsureCreated();
            return db;
        }
        catch
        {
            db.Dispose();
            throw;
        }
    }

    /// <summary>
    /// En andra kontext mot SAMMA databas (delar anslutning) men med tom change tracker.
    /// Användbart för att bevisa vad som faktiskt skrevs till databasen, inte vad den första
    /// kontexten har i minnet. Den nya kontexten äger inte anslutningen — disponera den första sist.
    /// </summary>
    public static AppDbContext CreateSecondContext(AppDbContext first)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite((SqliteConnection)first.Database.GetDbConnection())
            .Options;
        return new AppDbContext(options);
    }
}
