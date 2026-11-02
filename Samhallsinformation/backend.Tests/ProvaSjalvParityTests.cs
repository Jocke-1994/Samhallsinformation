namespace Samhallsinformation.Tests;

using System.Text.RegularExpressions;
using Samhallsinformation.Application.Uppdateringar;
using Xunit;

/// <summary>
/// "Prova själv"-målen finns på två ställen: backenden validerar nyckeln
/// (<see cref="UppdateringsVärden.ProvaSjalvMål"/>), frontenden äger adress,
/// flagga och kontokrav (<c>frontend/src/lib/provaSjalv.ts</c>). Ett mål som
/// bara läggs till på ena sidan blir antingen omöjligt att spara (400) eller
/// sparas men visar ingen länk. Samma textjämförelse som FeatureFlagFrontendParityTests.
/// </summary>
public class ProvaSjalvParityTests
{
    private static string? HittaFrontendFil()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var kandidat = Path.Combine(dir.FullName, "frontend", "src", "lib", "provaSjalv.ts");
            if (File.Exists(kandidat)) return kandidat;
            dir = dir.Parent;
        }
        return null;
    }

    [Fact]
    public void BackendMal_MatcharFrontendensPROVA_SJALV()
    {
        var sökväg = HittaFrontendFil();
        Assert.True(sökväg != null, "Hittade inte frontend/src/lib/provaSjalv.ts — kontrollera repo-layouten.");

        var text = File.ReadAllText(sökväg!);
        var start = text.IndexOf("export const PROVA_SJALV:", StringComparison.Ordinal);
        Assert.True(start >= 0, "Hittade inte PROVA_SJALV i provaSjalv.ts — har den bytt namn?");
        var slut = text.IndexOf("\n}", start, StringComparison.Ordinal);
        var block = text[start..slut];

        var frontend = Regex.Matches(block, @"^\s*'([a-z-]+)':\s*\{", RegexOptions.Multiline)
            .Select(m => m.Groups[1].Value).ToHashSet();
        Assert.True(frontend.Count >= 6, $"Regexen hittade bara {frontend.Count} mål — har formatet ändrats?");

        Assert.Equal(UppdateringsVärden.ProvaSjalvMål.Order(), frontend.Order());
    }
}
