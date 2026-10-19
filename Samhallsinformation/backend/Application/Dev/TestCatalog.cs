namespace Samhallsinformation.Application.Dev;

using System.Text.Json;
using System.Text.Json.Serialization;

/// <summary>
/// Läser backend/Data/test-catalog.json — en genererad inventering av
/// riktiga testfiler (backend.Tests/*.cs + frontend/src/test/*.test.tsx)
/// med antal [Fact]/[Theory]-metoder respektive it()/test()-block per fil.
///
/// Genereras lokalt (inte live i produktion — testprojektets DLL finns
/// inte i produktionsavbilden) via scriptet som körde
/// <c>dotnet test --list-tests</c> + en regex-skanning av frontend-testerna
/// 2026-10-19, se Funktionsidéer → #7/#8 i adminpanelen för bakgrunden.
/// Katalogen är "så färsk som senaste genereringen" — inte en live
/// CI-koppling. Regenerera genom att köra scriptet om igen när testsviten
/// ändrats mycket (ingen automatiserad trigger ännu).
///
/// Används av AdminFeatureIdeaController för att visa riktiga testnamn i
/// Funktionsidéernas "Automatiska tester"-sektion, istället för fri text.
/// </summary>
public static class TestCatalog
{
    public sealed record TestFileEntry(
        [property: JsonPropertyName("path")] string Path,
        [property: JsonPropertyName("className")] string ClassName,
        [property: JsonPropertyName("project")] string Project,
        [property: JsonPropertyName("count")] int Count,
        [property: JsonPropertyName("names")] IReadOnlyList<string> Names);

    public sealed record CatalogData(
        [property: JsonPropertyName("generatedAt")] string GeneratedAt,
        [property: JsonPropertyName("backendTotal")] int BackendTotal,
        [property: JsonPropertyName("frontendTotal")] int FrontendTotal,
        [property: JsonPropertyName("files")] IReadOnlyList<TestFileEntry> Files);

    private static readonly CatalogData Tom = new(DateTime.MinValue.ToString("o"), 0, 0, []);

    // Läses om vid varje anrop — admin-only, lågtrafik, filen är liten.
    // Ingen cache: en cache skulle göra testning av flera olika kataloger
    // (eller en framtida "ladda upp ny katalog"-funktion) svårare än det
    // är värt för den trafikvolymen.
    public static CatalogData Load(string contentRootPath)
    {
        var path = System.IO.Path.Combine(contentRootPath, "Data", "test-catalog.json");
        if (!File.Exists(path)) return Tom;

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<CatalogData>(json) ?? Tom;
    }

    public static IEnumerable<TestFileEntry> Search(CatalogData catalog, string? query)
    {
        if (string.IsNullOrWhiteSpace(query)) return catalog.Files;
        var q = query.Trim();
        return catalog.Files.Where(f =>
            f.Path.Contains(q, StringComparison.OrdinalIgnoreCase) ||
            f.ClassName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
            f.Names.Any(n => n.Contains(q, StringComparison.OrdinalIgnoreCase)));
    }

    public static TestFileEntry? Find(CatalogData catalog, string path) =>
        catalog.Files.FirstOrDefault(f => f.Path == path);
}
