namespace Samhallsinformation.Application.Sources;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Uppstartsseed av ingestorernas hårdkodade <c>Sources</c>-rader (utbruten ur Program.cs så att den går att
/// testa). Finns ID:t redan uppdateras raden med seedens Name/ShortName/BaseUrl/Type/Url (Category om satt;
/// <c>IsPublished</c> rörs aldrig — admin-ändringar ska överleva omstart).
///
/// Kollisionsvakt (V4-1a, E2#5): tillhör ID:t en källa med ANNAN identitet — en admin-skapad källa som råkat få
/// ett ingestor-ID — skrivs den INTE över; en Warning loggas och posten hoppas över. Identitet = samma
/// <c>Type</c> och <c>ShortName</c> samt samma <c>Url</c> ELLER <c>BaseUrl</c> (så att en legitim URL-ändring i
/// koden fortfarande uppdaterar raden, men en helt annan källa aldrig kapas).
/// </summary>
public static class IngestorSourceSeeder
{
    /// <summary>Returnerar antalet poster som hoppades över pga ID-kollision.</summary>
    public static async Task<int> SeedAsync(
        AppDbContext db, IEnumerable<Source> seedSources, ILogger logger, CancellationToken ct = default)
    {
        var skipped = 0;
        foreach (var source in seedSources)
        {
            var existing = await db.Sources.FindAsync(new object[] { source.Id }, ct);
            if (existing == null)
            {
                db.Sources.Add(source);
                continue;
            }

            if (!SameIdentity(existing, source))
            {
                skipped++;
                logger.LogWarning(
                    "Ingestor-seeden hoppar över källa-ID {Id}: ID:t tillhör redan \"{ExistingName}\" " +
                    "({ExistingShortName}, {ExistingType}, {ExistingUrl}) men ingestorn heter \"{SeedName}\" " +
                    "({SeedShortName}, {SeedType}, {SeedUrl}). Raden skrivs INTE över — ge ingestorn ett ledigt ID.",
                    source.Id, existing.Name, existing.ShortName, existing.Type, existing.Url ?? existing.BaseUrl,
                    source.Name, source.ShortName, source.Type, source.Url ?? source.BaseUrl);
                continue;
            }

            existing.Name      = source.Name;
            existing.ShortName = source.ShortName;
            existing.BaseUrl   = source.BaseUrl;
            existing.Type      = source.Type;
            existing.Url       = source.Url;
            // IsPublished uppdateras INTE — admin-ändringar ska överleva restarts
            if (source.Category != null) existing.Category = source.Category;
        }

        await db.SaveChangesAsync(ct);
        return skipped;
    }

    public static bool SameIdentity(Source existing, Source seed) =>
        existing.Type == seed.Type
        && string.Equals(existing.ShortName, seed.ShortName, StringComparison.OrdinalIgnoreCase)
        && (SameUrl(existing.Url, seed.Url) || SameUrl(existing.BaseUrl, seed.BaseUrl));

    private static bool SameUrl(string? a, string? b) =>
        !string.IsNullOrWhiteSpace(a) && !string.IsNullOrWhiteSpace(b)
        && string.Equals(a.Trim().TrimEnd('/'), b.Trim().TrimEnd('/'), StringComparison.OrdinalIgnoreCase);
}
