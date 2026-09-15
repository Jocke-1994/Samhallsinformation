namespace Samhallsinformation.Application.FeatureFlags;

// Speglar frontend/src/lib/featureFlags.ts (FLAG_GRUPPER, fältet
// defaultAktiv) — hålls manuellt i synk, samma accepterade duplicering som
// redan finns för Polisen-kategorierna (PolisenBevakningMatcher.Kategorier).
// Behövs på backend för att räkna ut en flaggas EFFEKTIVA status (kodens
// default, om inte admin satt en avvikelse i FeatureFlagOverrides) utan att
// fråga frontend — första användningen: GET /api/faq döljer frågor vars
// kopplade funktion faktiskt är avstängd (se
// docs/vault/Ideer/FAQ-synk-kundtjanstbot.md).
public static class FeatureFlagDefaults
{
    public static readonly IReadOnlyDictionary<string, bool> DefaultAktiv = new Dictionary<string, bool>
    {
        ["flode_olasta_badge"]        = false,
        ["flode_sparat"]              = false,
        ["flode_dela"]                = false,
        ["kallor_lagg_till"]          = false,
        ["kallor_aktiva"]             = true,
        ["kallor_rekommenderade"]     = false,
        ["kallor_alla"]               = true,
        ["kallor_polisen_filter"]     = false,
        ["notif_obligatoriska"]       = false,
        ["notif_mottagare"]           = false,
        ["notif_stor_ej"]             = false,
        ["notif_leveranslage"]        = false,
        ["notif_historik"]            = false,
        ["notif_push"]                = false,
        ["konto_info"]                = true,
        ["konto_losenord"]            = true,
        ["konto_visningsnamn"]        = true,
        ["konto_tvafaktor"]           = false,
        ["konto_sessioner"]           = false,
        ["konto_aktivitetslogg"]      = false,
        ["konto_samtycke"]            = false,
        ["konto_datahantering"]       = true,
        ["konto_tema"]                = true,
        ["uppdateringar_senaste"]     = false,
        ["uppdateringar_pagang"]      = false,
        ["uppdateringar_kanda_problem"] = false,
        ["uppdateringar_historik"]    = false,
        ["support_arenden"]           = false,
        ["support_systemstatus"]      = false,
        ["support_faq"]               = true,
        ["konto_epost_paminnelse"]    = true,
    };

    // En okänd flagg-nyckel (t.ex. en ny flagga i frontend som den här
    // listan inte hunnit spegla än) antas AKTIV — fail-open, samma princip
    // som redan gäller när Polisen-matchningen möter en okänd kategori.
    // Hellre visa en fråga för mycket än dölja en som borde synas.
    public static bool IsEffectivelyActive(string flagKey, IReadOnlyDictionary<string, bool> overrides)
    {
        if (overrides.TryGetValue(flagKey, out var overridden)) return overridden;
        if (DefaultAktiv.TryGetValue(flagKey, out var def)) return def;
        return true;
    }
}
