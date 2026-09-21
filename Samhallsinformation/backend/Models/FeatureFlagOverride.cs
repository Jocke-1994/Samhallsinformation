namespace Samhallsinformation.Models;

// Flaggornas definitioner (label, beskrivning, defaultAktiv) ligger kvar i
// frontendens lib/featureFlags.ts — det är statisk kodkonfiguration, inte
// data. Den här tabellen håller bara admins avvikelser från de defaulten,
// en rad per flagga som någon gång ändrats bort från sitt kodade default.
public class FeatureFlagOverride
{
    public string Key   { get; set; } = "";
    public bool   Value { get; set; }

    // Satt av AdminFeatureIdeaController när en kopplad idés Stage blir
    // "lanseringsklar", eller manuellt i Feature flags-panelen — driver
    // urvalslistan i Uppdateringars schemaläggningsflöde (se
    // ScheduledReleaseBackgroundService). Rör aldrig Value.
    public bool RedoAttLanseras { get; set; } = false;
}
