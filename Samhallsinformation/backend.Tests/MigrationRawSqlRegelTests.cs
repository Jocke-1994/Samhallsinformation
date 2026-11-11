namespace Samhallsinformation.Tests;

using System.Text.RegularExpressions;
using Xunit;

// Regeln "varje ny EF-migration med en bool/Guid/DateTime-kolumn behöver ett
// raw-SQL-block med rätt Postgres-typ i DatabaseBootstrapper.cs, i SAMMA PR"
// fanns tidigare bara som en minnesregel. Den missades en gång (session 32,
// AddPushNotifKategorier): kolumnerna blev integer i produktion och inloggningen
// kraschade för alla i ~10 minuter.
//
// Varför det behövs: migrationerna scaffoldas mot SQLite och skriver
// type: "INTEGER"/"TEXT", som Npgsql tar bokstavligt mot PostgreSQL. Lokalt
// (SQLite) och i alla andra tester (InMemory) syns felet aldrig — bara i produktion.
//
// Testet läser källfilerna direkt (samma grepp som FeatureFlagFrontendParityTests).
public class MigrationRawSqlRegelTests
{
    // Äldre migrationer som hanteras på annat sätt. FRYST lista — en ny
    // migration ska aldrig läggas till här, den ska få ett riktigt block.
    private static readonly Dictionary<string, string> Undantag = new()
    {
        ["20260216135439_InitialCreate"] = "Skapades innan PostgreSQL användes; produktionsschemat byggdes separat.",
        ["20260615111721_AddUsers"] = "Users.Id konverteras text→uuid av ett självläkande DO-block före MigrateAsync.",
        ["20260615135248_AddIsTestOnlyToSource"] = "Sources.IsPublished rättas integer→boolean av ett självläkande DO-block.",
        ["20260625115213_AddFetchStatusToSource"] = "Sources.LastFetchedAt rättas text→timestamptz av ett självläkande DO-block.",
    };

    private static readonly Dictionary<string, string> PostgresTyp = new()
    {
        ["bool"] = "boolean",
        ["Guid"] = "uuid",
        ["DateTime"] = "timestamp", // timestamp / timestamptz
    };

    private static readonly Regex RiskabelKolumn =
        new(@"(?:AddColumn|table\.Column)<(bool|Guid|DateTime)\??>", RegexOptions.Compiled);

    private static readonly Regex AddColumn =
        new(@"AddColumn<(bool|Guid|DateTime)\??>\(\s*name:\s*""(\w+)"",\s*table:\s*""(\w+)""", RegexOptions.Compiled);

    private record Migration(string Id, string Up);

    private static string HittaBackend()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var kandidat = Path.Combine(dir.FullName, "backend", "Infrastructure", "DatabaseBootstrapper.cs");
            if (File.Exists(kandidat)) return Path.Combine(dir.FullName, "backend");
            dir = dir.Parent;
        }
        throw new InvalidOperationException(
            "Hittade inte backend/Infrastructure/DatabaseBootstrapper.cs genom att gå uppåt från " +
            "AppContext.BaseDirectory — backend och backend.Tests förväntas vara syskon.");
    }

    private static List<Migration> RiskablaMigrationer(string backend) =>
        Directory.GetFiles(Path.Combine(backend, "Migrations"), "2*.cs")
            .Where(f => !f.EndsWith(".Designer.cs"))
            .Select(f => new Migration(
                Path.GetFileNameWithoutExtension(f),
                // Bara Up() — Down() lägger tillbaka gamla kolumner och är irrelevant här.
                File.ReadAllText(f).Split("protected override void Down")[0]))
            .Where(m => RiskabelKolumn.IsMatch(m.Up))
            .OrderBy(m => m.Id)
            .ToList();

    [Fact]
    public void Sökningen_HittarDeKändaRiskablaMigrationerna()
    {
        // Testar testet: om EF ändrar sitt kodformat och regexen slutar matcha
        // skulle de andra testerna tyst godkänna allt. 42 fanns 2026-11-02.
        var antal = RiskablaMigrationer(HittaBackend()).Count;
        Assert.True(antal >= 42, $"Hittade bara {antal} migrationer med bool/Guid/DateTime — har migrationsformatet ändrats?");
    }

    [Fact]
    public void VarjeRiskabelMigration_HarEttRawSqlBlock()
    {
        var backend = HittaBackend();
        var bootstrapper = File.ReadAllText(Path.Combine(backend, "Infrastructure", "DatabaseBootstrapper.cs"));

        var saknas = RiskablaMigrationer(backend)
            .Where(m => !Undantag.ContainsKey(m.Id))
            .Where(m => !bootstrapper.Contains($"pendingMigrations.Contains(\"{m.Id}\")"))
            .Select(m => m.Id)
            .ToList();

        Assert.True(saknas.Count == 0,
            "Migrationer med bool/Guid/DateTime-kolumner saknar raw-SQL-block i DatabaseBootstrapper.cs. " +
            "Utan det skapas kolumnerna med fel typ i PostgreSQL och EF kraschar vid läsning. " +
            "Lägg till ett `if (pendingMigrations.Contains(\"<id>\"))`-block med explicita " +
            "boolean/uuid/timestamptz-typer (se de befintliga blocken):\n  " + string.Join("\n  ", saknas));
    }

    [Fact]
    public void VarjeNyKolumn_FårRättPostgresTypIBlocket()
    {
        // Ett block som finns men skriver fel typ (t.ex. integer för en bool)
        // ska också fångas — bara att blocket finns räcker inte.
        var backend = HittaBackend();
        var rader = File.ReadAllLines(Path.Combine(backend, "Infrastructure", "DatabaseBootstrapper.cs"));

        var fel = new List<string>();
        foreach (var m in RiskablaMigrationer(backend).Where(m => !Undantag.ContainsKey(m.Id)))
            foreach (Match k in AddColumn.Matches(m.Up))
            {
                var (typ, kolumn, tabell) = (k.Groups[1].Value, k.Groups[2].Value, k.Groups[3].Value);
                var förväntad = PostgresTyp[typ];
                if (!rader.Any(r => r.Contains($"\"\"{kolumn}\"\"") && r.Contains(förväntad, StringComparison.OrdinalIgnoreCase)))
                    fel.Add($"{m.Id}: {tabell}.{kolumn} ({typ}) — ingen rad i blocket med typen {förväntad}");
            }

        Assert.True(fel.Count == 0, "Kolumner utan rätt Postgres-typ i DatabaseBootstrapper.cs:\n  " + string.Join("\n  ", fel));
    }

    [Fact]
    public void Undantagslistan_InnehållerBaraMigrationerSomFinns()
    {
        // Håller den frysta listan ärlig: ett undantag för en borttagen eller
        // omdöpt migration ska inte ligga kvar och se ut att skydda något.
        var ids = Directory.GetFiles(Path.Combine(HittaBackend(), "Migrations"), "2*.cs")
            .Select(Path.GetFileNameWithoutExtension).ToHashSet();
        Assert.All(Undantag.Keys, id => Assert.Contains(id, ids));
    }
}
