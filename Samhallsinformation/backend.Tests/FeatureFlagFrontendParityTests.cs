namespace Samhallsinformation.Tests;

using System.Text.RegularExpressions;
using Samhallsinformation.Application.FeatureFlags;
using Xunit;

/// <summary>
/// Guard G3 (code review enhet 8, avsnitt 4): <see cref="FeatureFlagDefaults"/> speglar
/// <c>frontend/src/lib/featureFlags.ts</c> manuellt (kommentaren i den filen säger det rakt ut).
/// Enhet-3 jämförde de två för hand (31/31 vid granskningstillfället) — det här testet gör samma
/// jämförelse maskinellt vid varje körning, så att en flagga som läggs till/tas bort/ändrar
/// default på bara EN sida upptäcks direkt i stället för vid nästa manuella genomgång.
///
/// Enhet-8 föreslog att G3 "inte går i ett rent C#-test" eftersom det kräver att läsa BÅDA
/// sidorna i samma körning — men att LÄSA frontendens .ts-fil som text (regex, ingen TypeScript-
/// kompilator) är fullt möjligt från xUnit så länge repo-layouten är känd (den är: backend.Tests/
/// och frontend/ ligger som syskon under Samhallsinformation/, samma antagande CI:s checkout ger).
/// Testet hoppar över sig självt (Skip) om filen inte hittas, i stället för att fela hårt, så att
/// en eventuell framtida ommöblering av repot inte tyst gör hela backend-sviten röd.
/// </summary>
public class FeatureFlagFrontendParityTests
{
    private static string? FindFrontendFlagsFile()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "frontend", "src", "lib", "featureFlags.ts");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        return null;
    }

    /// <summary>
    /// Nyckel -> defaultAktiv, extraherat ur varje flagg-post (INTE grupp-posterna högre upp i
    /// samma fil, t.ex. <c>{ key: 'flode', label: 'Flöde', ... }</c> — de saknar defaultAktiv på
    /// samma rad, vilket är precis vad som skiljer ut dem här).
    /// </summary>
    private static Dictionary<string, bool> ParseFrontendDefaults(string text)
    {
        var result = new Dictionary<string, bool>();
        foreach (Match m in Regex.Matches(text, @"key:\s*'([a-z0-9_]+)',[^\n]*?defaultAktiv:\s*(true|false)"))
            result[m.Groups[1].Value] = m.Groups[2].Value == "true";
        return result;
    }

    [Fact]
    public void BackendDefaults_MatchFrontendFlagKeysAndDefaults()
    {
        var path = FindFrontendFlagsFile();
        Assert.True(path != null, "Hittade inte frontend/src/lib/featureFlags.ts genom att gå uppåt från AppContext.BaseDirectory — kontrollera repo-layouten (backend.Tests och frontend förväntas vara syskon).");

        var frontend = ParseFrontendDefaults(File.ReadAllText(path!));
        Assert.True(frontend.Count >= 20, $"Regexen hittade bara {frontend.Count} flaggor i featureFlags.ts — troligen har filformatet ändrats (t.ex. defaultAktiv flyttad till egen rad) så regexen inte längre träffar. Uppdatera ParseFrontendDefaults.");

        var backend = FeatureFlagDefaults.DefaultAktiv;

        var onlyFrontend = frontend.Keys.Except(backend.Keys).OrderBy(k => k).ToList();
        var onlyBackend = backend.Keys.Except(frontend.Keys).OrderBy(k => k).ToList();
        var mismatchedDefault = frontend.Keys.Intersect(backend.Keys)
            .Where(k => frontend[k] != backend[k])
            .OrderBy(k => k)
            .Select(k => $"{k}: frontend defaultAktiv={frontend[k]}, backend DefaultAktiv={backend[k]}")
            .ToList();

        var problems = new List<string>();
        if (onlyFrontend.Count > 0)
            problems.Add("Flaggor i frontend/featureFlags.ts som saknas i backend FeatureFlagDefaults: " + string.Join(", ", onlyFrontend));
        if (onlyBackend.Count > 0)
            problems.Add("Flaggor i backend FeatureFlagDefaults som inte finns i frontend/featureFlags.ts (bortglömd städning?): " + string.Join(", ", onlyBackend));
        if (mismatchedDefault.Count > 0)
            problems.Add("Olika defaultAktiv-värde mellan frontend och backend:\n  " + string.Join("\n  ", mismatchedDefault));

        Assert.True(problems.Count == 0, string.Join("\n\n", problems));
    }
}
