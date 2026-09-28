namespace Samhallsinformation.Tests;

using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

/// <summary>
/// Delad Testcontainers-fixtur för PostgreSQL (V4-6b, enhet-8 G6 + "3–5 PG-bevis").
///
/// EN container för HELA testkörningen (inte en per test — en körande Postgres-container tar
/// några sekunder att starta, för långsamt att göra om för varje enskilt test). Delas via
/// <see cref="PostgresCollection"/> (<c>[Collection("Postgres")]</c>) mellan alla klasser som
/// behöver en riktig Postgres — xUnit garanterar EN instans av fixturen för hela collectionen och
/// kör <see cref="DisposeAsync"/> när sista testet i collectionen är klart.
///
/// Ett enskilt test som behöver en GARANTERAT tom databas (ingen migrationshistorik, t.ex. G6:s
/// "starta mot tom Postgres"-test) får INTE dela databas med andra tester — containern delas,
/// databaserna gör det inte. <see cref="CreateFreshDatabaseAsync"/> skapar en ny, unikt namngiven
/// databas i samma container per anrop.
///
/// Postgres-version: <c>postgres:16</c>. Motivering (ingen exakt versionsgaranti från Railway
/// finns): 16 är, vid det här skrivandet, den nyaste versionen med bred spridning och stöds fullt
/// ut av Npgsql 10.x/EF Core 10 — en rimlig approximation av vad ett litet, nyare Railway-projekt
/// kör, och betydligt närmare produktionens verklighet än SQLite (som redan används av alla andra
/// tester och aldrig kunde fånga 42804-klassen av fel, se enhet-8.md).
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public async Task InitializeAsync()
    {
        try
        {
            // Build() (inte bara StartAsync()) kastar redan här om Docker-daemonen inte går att nå
            // (DotNet.Testcontainers.Builders.AbstractBuilder.Validate() pingar Docker-endpointen) —
            // båda måste vara inom samma try/catch, annars läcker det kryptiska originalfelet ändå.
            _container = new PostgreSqlBuilder("postgres:16").Build();
            await _container.StartAsync();
        }
        catch (Exception ex)
        {
            // Vanligaste orsaken till att det här kastar lokalt: Docker är inte installerat/igång.
            // Utan den här try/catch:en blir felet en kryptisk timeout djupt inne i Testcontainers/
            // Docker.DotNet — med den blir det ett tydligt, handlingsbart meddelande direkt.
            throw new InvalidOperationException(
                "Docker krävs för Postgres-testerna (kategori \"Postgres\") men kunde inte nås — " +
                "Testcontainers kunde inte starta en postgres:16-container. Kör dessa tester bara " +
                "där Docker finns (CI:s ubuntu-latest-runner har det, verifierat 2026-09-27). " +
                "Lokalt utan Docker: kör resten av sviten med 'dotnet test --filter \"Category!=Postgres\"'. " +
                $"Ursprungligt fel från Testcontainers: {ex.GetType().Name}: {ex.Message}", ex);
        }
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }

    /// <summary>
    /// Skapar en ny, helt tom databas (inget schema, ingen migrationshistorik) i samma container
    /// och returnerar en Npgsql-connection string mot den. Namnet är unikt per anrop så att
    /// sekventiella eller parallella tester i samma collection aldrig kan kollidera eller läcka
    /// tillstånd mellan varandra.
    /// </summary>
    public async Task<string> CreateFreshDatabaseAsync()
    {
        if (_container is null)
            throw new InvalidOperationException("PostgresFixture.InitializeAsync() har inte körts än.");

        var dbName = "testdb_" + Guid.NewGuid().ToString("N");

        await using (var admin = new NpgsqlConnection(_container.GetConnectionString()))
        {
            await admin.OpenAsync();
            await using var cmd = admin.CreateCommand();
            // Databasnamnet är ett internt genererat Guid-baserat namn (aldrig användarindata),
            // så vanlig strängformatering här är säker — ingen SQL-injektionsyta.
            cmd.CommandText = $"CREATE DATABASE \"{dbName}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        var csBuilder = new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
        {
            Database = dbName,
        };
        return csBuilder.ConnectionString;
    }
}

/// <summary>
/// xUnit-collection som delar EN <see cref="PostgresFixture"/> (och därmed en container) mellan
/// alla testklasser taggade <c>[Collection("Postgres")]</c>. Klasser i samma collection körs INTE
/// parallellt med varandra (xUnits standardbeteende) — tillräckligt för den här sviten, som ändå
/// isolerar per-test-tillstånd via <see cref="PostgresFixture.CreateFreshDatabaseAsync"/>.
/// </summary>
[CollectionDefinition("Postgres")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
}
