namespace Samhallsinformation.Models;

// Flaggornas definitioner (label, beskrivning, defaultAktiv) ligger kvar i
// frontendens lib/featureFlags.ts — det är statisk kodkonfiguration, inte
// data. Den här tabellen håller bara admins avvikelser från de defaulten,
// en rad per flagga som någon gång ändrats bort från sitt kodade default.
public class FeatureFlagOverride
{
    public string Key { get; set; } = "";
    public bool Value { get; set; }

    // Satt av AdminFeatureIdeaController när en kopplad idés Stage blir
    // "lanseringsklar", eller manuellt i Feature flags-panelen — driver
    // urvalslistan i Uppdateringars schemaläggningsflöde (se
    // ScheduledReleaseBackgroundService). Rör aldrig Value.
    public bool RedoAttLanseras { get; set; } = false;

    // Testmiljö-idén, steg 1 (Beslut 2026-10-19, se docs/vault/Ideer/
    // Testmiljö.md): en tredje synlighetsnivå utöver på/av. Bara
    // meningsfull när Value=true — FeatureFlagsController.GetOverrides
    // returnerar då false för alla utom en inloggad Admin, så en flagga kan
    // testas skarpt mot produktionsdata utan att synas för riktiga besökare.
    // ActivateFlagsAsync nollställer den vid en riktig (schemalagd) lansering
    // — den ska aldrig tyst hålla en "färdig" funktion dold.
    public bool EndastAdmin { get; set; } = false;
}
