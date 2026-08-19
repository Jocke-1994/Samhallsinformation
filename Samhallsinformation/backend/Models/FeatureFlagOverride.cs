namespace Samhallsinformation.Models;

// Flaggornas definitioner (label, beskrivning, defaultAktiv) ligger kvar i
// frontendens lib/featureFlags.ts — det är statisk kodkonfiguration, inte
// data. Den här tabellen håller bara admins avvikelser från de defaulten,
// en rad per flagga som någon gång ändrats bort från sitt kodade default.
public class FeatureFlagOverride
{
    public string Key   { get; set; } = "";
    public bool   Value { get; set; }
}
