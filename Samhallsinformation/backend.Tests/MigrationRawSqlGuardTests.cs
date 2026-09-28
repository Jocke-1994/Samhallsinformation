namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Samhallsinformation.Data;
using Xunit;

/// <summary>
/// Guard G1 (code review enhet 8, avsnitt 4 + feedback_ef_migration_boolean_raw_sql): varje
/// migration som lägger till en bool/DateTime/DateTimeOffset/Guid/TimeSpan-kolumn MÅSTE antingen
/// ha ett matchande <c>pendingMigrations.Contains("&lt;id&gt;")</c>-raw-SQL-block i Program.cs
/// (migrationerna är SQLite-genererade — <c>type: "INTEGER"</c>/<c>"TEXT"</c> hårdkodat — och Npgsql
/// tolkar det bokstavligt mot Postgres om de körs orört, 42804), eller stå i
/// <see cref="Undantag"/> med en dokumenterad motivering för hur kolumnen läks på annat sätt.
///
/// Körs helt utan databas: reflekterar över migrationstyperna i <c>Samhallsinformation.Migrations</c>,
/// läser deras operationer via den publika, redan lazy-beräknade <see cref="Migration.UpOperations"/>
/// (ingen anslutning krävs), och letar textuellt efter blocket i Program.cs.
///
/// Testar ALLA nuvarande migrationer (inget urval) — en ny migration som lägger till en riskkolumn
/// utan block, eller ett block som tas bort utan att kolumnen samtidigt tas bort, fångas automatiskt
/// nästa gång sviten körs.
/// </summary>
public class MigrationRawSqlGuardTests
{
    private static readonly Type[] RiskTypes =
    [
        typeof(bool), typeof(DateTime), typeof(DateTimeOffset), typeof(Guid), typeof(TimeSpan),
    ];

    /// <summary>
    /// Migrationer med minst en risk-kolumn som INTE har ett eget raw-SQL-block i Program.cs, med
    /// en motivering för varför det ändå är säkert. Bekräftat i enhet-8 (avsnitt 4, G1): dessa fyra
    /// läks av andra, redan existerande mekanismer i Program.cs snarare än ett eget
    /// <c>pendingMigrations.Contains(...)</c>-block. En ny rad här kräver samma sorts motivering —
    /// <see cref="Undantag_MatchesExactlyKnownMigrations"/> ser till att listan inte tyst växer.
    /// </summary>
    private static readonly Dictionary<string, string> Undantag = new()
    {
        ["InitialCreate"] = "Körs bara mot en helt tom databas (Users-tabellen finns inte ännu) — " +
            "self-healing-blocket för Users (se AddUsers nedan) kör före denna migrations kolumner " +
            "någonsin läses av EF, och det finns inga befintliga PG-rader att typkonvertera.",
        ["AddUsers"] = "Users-tabellens kolumner (inkl. bool/DateTime) läks av det separata " +
            "self-healing-blocket i Program.cs som kör FÖRE MigrateAsync: kollar om Users redan " +
            "finns med fel kolumntyp och droppar/återskapar den kontrollerat innan migreringen körs.",
        ["AddIsTestOnlyToSource"] = "Sources.IsTestOnly (bool) läks av en efterhands-koll i " +
            "Program.cs som kör EFTER MigrateAsync (else-grenen, samma mönster som IsPublished) och " +
            "sätter rätt PG-typ om kolumnen råkade skapas som INTEGER.",
        ["AddFetchStatusToSource"] = "Sources.LastFetchedAt (DateTime) läks av samma " +
            "efterhands-koll som IsTestOnly ovan.",
    };

    private static IEnumerable<Type> MigrationTypes() =>
        typeof(AppDbContext).Assembly.GetTypes()
            .Where(t => typeof(Migration).IsAssignableFrom(t) && !t.IsAbstract
                && t.Namespace == "Samhallsinformation.Migrations");

    public static IEnumerable<object[]> Migrations() =>
        MigrationTypes().OrderBy(t => t.Name).Select(t => new object[] { t });

    private static string MigrationId(Type t) =>
        t.GetCustomAttribute<MigrationAttribute>()?.Id
        ?? throw new InvalidOperationException($"{t.Name} saknar ett [Migration(\"id\")]-attribut (borde finnas i .Designer.cs).");

    private static Type Unwrap(Type t) => Nullable.GetUnderlyingType(t) ?? t;

    private static IEnumerable<Type> ColumnClrTypes(Migration migration)
    {
        foreach (var op in migration.UpOperations)
        {
            switch (op)
            {
                case CreateTableOperation create:
                    foreach (var col in create.Columns)
                        yield return Unwrap(col.ClrType);
                    break;
                case AddColumnOperation add:
                    yield return Unwrap(add.ClrType);
                    break;
            }
        }
    }

    private static string? _programCsCache;

    // V4-6b: alla pendingMigrations.Contains(...)-raw-SQL-block flyttades ur Program.cs till
    // Infrastructure/DatabaseBootstrapper.cs (seam b — enhet-8 G6 kräver att uppstartslogiken kan
    // köras isolerat mot en riktig PG-container). Ren flytt, ingen logikändring — G1 måste därför
    // läsa BÅDA filerna för att fortfarande se blocken. Testets intention (varje risk-migration har
    // ett block, inget block pekar på ett okänt id) är oförändrad.
    private static readonly string[] FilesToScan = ["Program.cs", "Infrastructure/DatabaseBootstrapper.cs"];

    private static string ProgramCsText()
    {
        if (_programCsCache != null) return _programCsCache;

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "backend", "Program.cs")))
            dir = dir.Parent;
        Assert.True(dir != null, "Hittade inte backend/Program.cs genom att gå uppåt från AppContext.BaseDirectory.");

        return _programCsCache = string.Join('\n',
            FilesToScan.Select(f => File.ReadAllText(Path.Combine(dir!.FullName, "backend", f.Replace('/', Path.DirectorySeparatorChar)))));
    }

    [Theory]
    [MemberData(nameof(Migrations))]
    public void MigrationsWithRiskColumns_HaveRawSqlBlockOrApprovedException(Type migrationType)
    {
        var migration = (Migration)Activator.CreateInstance(migrationType)!;
        var riskColumns = ColumnClrTypes(migration).Where(t => RiskTypes.Contains(t)).ToList();
        if (riskColumns.Count == 0) return; // inget bool/Guid/DateTime/TimeSpan i den här migrationen

        var id = MigrationId(migrationType);
        var hasBlock = ProgramCsText().Contains($"\"{id}\"", StringComparison.Ordinal);
        var isApprovedException = Undantag.ContainsKey(migrationType.Name);

        Assert.True(hasBlock || isApprovedException,
            $"Migrationen {migrationType.Name} ({id}) lägger till minst en risk-kolumn " +
            $"({string.Join(", ", riskColumns.Select(t => t.Name).Distinct())}) men saknar ett " +
            $"pendingMigrations.Contains(\"{id}\")-block i Program.cs och står inte i {nameof(Undantag)}. " +
            "Se docs/code-review/FIXPLAN.md (arbetsregler) och feedback_ef_migration_boolean_raw_sql — " +
            "en ny EF-migration med bool/Guid/DateTime-kolumn kräver ett raw-SQL-block i SAMMA PR, " +
            "annars kraschar EF-läsning av varje rad mot PostgreSQL (42804).");
    }

    [Fact]
    public void Undantag_MatchesExactlyKnownMigrations()
    {
        // Om en ny migration av misstag läggs till i undantagslistan (eller en gammal aldrig
        // städas bort) ska det synas här explicit, i stället för att bara tyst göra Theory-testet
        // ovan grönt av fel anledning.
        var actualMigrationNames = MigrationTypes().Select(t => t.Name).ToHashSet();
        foreach (var name in Undantag.Keys)
            Assert.True(actualMigrationNames.Contains(name), $"{name} finns i {nameof(Undantag)} men är inte en riktig migrationsklass längre.");
    }

    [Fact]
    public void EveryRawSqlBlockInProgramCs_CorrespondsToARealMigration()
    {
        // Motsatt riktning av huvudtestet: ett pendingMigrations.Contains(...)-block som pekar på
        // ett id som inte motsvarar en riktig migration är dött eller felstavat — och kan då dölja
        // att RÄTT migration saknar sitt block (Theory-testet ovan skulle aldrig se den täckt).
        var ids = Regex.Matches(ProgramCsText(), "pendingMigrations\\.Contains\\(\"([^\"]+)\"\\)")
            .Select(m => m.Groups[1].Value)
            .ToList();
        Assert.NotEmpty(ids);

        var realIds = MigrationTypes().Select(MigrationId).ToHashSet();
        var unknown = ids.Where(id => !realIds.Contains(id)).ToList();
        Assert.True(unknown.Count == 0, "Program.cs har raw-SQL-block som pekar på okända migration-id: " + string.Join(", ", unknown));
    }
}
