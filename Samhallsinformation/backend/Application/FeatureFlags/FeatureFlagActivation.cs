namespace Samhallsinformation.Application.FeatureFlags;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Delad mellan ScheduledReleaseBackgroundService, UppdateringarController
// (manuell publicering av en väntande schemaläggning) och
// AdminFeatureIdeaController/FeatureFlagsController (redo-markering) — en
// enda plats för "hämta eller skapa en override-rad" och "aktivera en
// flagga", istället för att varje anropsställe implementerar samma logik
// separat (upptäckt i code review av PR #590, findings om duplicerad
// find-or-create/JSON-parsning).
public static class FeatureFlagActivation
{
    public static async Task<FeatureFlagOverride> GetOrCreateOverrideAsync(AppDbContext db, string key, CancellationToken ct = default)
    {
        var flagg = await db.FeatureFlagOverrides.FindAsync([key], ct);
        if (flagg == null)
        {
            flagg = new FeatureFlagOverride { Key = key };
            db.FeatureFlagOverrides.Add(flagg);
        }
        return flagg;
    }

    // Aktiverar varje flagga i listan (Value=true, RedoAttLanseras=false) och
    // loggar — men bara för flaggor som faktiskt INTE redan var fullt aktiva,
    // så en omkörning (t.ex. en misslyckad batch som körs om) inte skriver
    // dubblerade Aktivitetslogg-rader för flaggor som redan var på. En flagga
    // som bara var aktiv för Admin (testad skarpt via Testmiljö-läget, se
    // FeatureFlagOverride.EndastAdmin) räknas INTE som redan aktiv här — en
    // riktig schemalagd lansering ska alltid gå fullt publik.
    public static async Task ActivateFlagsAsync(
        AppDbContext db, IAktivitetsloggService aktivitetslogg,
        IEnumerable<string> flaggnycklar, string kontext, string aktörTyp, CancellationToken ct = default)
    {
        foreach (var key in flaggnycklar)
        {
            var flagg = await GetOrCreateOverrideAsync(db, key, ct);
            if (flagg.Value && !flagg.EndastAdmin) continue; // redan fullt aktiv — inget att göra eller logga

            flagg.Value = true;
            flagg.RedoAttLanseras = false;
            flagg.EndastAdmin = false;

            await aktivitetslogg.LogAsync(
                aktörTyp, LoggTyper.Konfiguration,
                $"Feature flag aktiverad automatiskt — {key}", kontext);
        }
    }

    public static string? SerialiseraFlaggor(List<string>? flaggor) =>
        flaggor == null || flaggor.Count == 0 ? null : JsonSerializer.Serialize(flaggor);

    public static List<string> DeserialiseraFlaggor(string? json) =>
        string.IsNullOrEmpty(json) ? [] : JsonSerializer.Deserialize<List<string>>(json) ?? [];
}
