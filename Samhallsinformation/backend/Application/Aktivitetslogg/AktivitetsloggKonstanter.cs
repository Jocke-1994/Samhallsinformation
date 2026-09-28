namespace Samhallsinformation.Application.Aktivitetslogg;

// Delad källa till sanning för AktörTyp/Typ-strängarna som skrivs till
// AdminActivityLog — undviker att write-sites i olika controllers (#491
// wave 1) råkar särskriva samma kategori på olika sätt.
public static class AktörTyper
{
    public const string System = "System";
    public const string Admin  = "Admin";
}

public static class LoggTyper
{
    public const string Ingestor      = "Ingestor";      // system, redan etablerad (IngestorRunLog)
    public const string Fel           = "Fel";            // system, redan etablerad (IngestorRunLog)
    public const string Kontoåtgärd   = "Kontoåtgärd";    // admin/support, redan etablerad (Sparat-ångra)
    public const string Konfiguration = "Konfiguration";  // feature flags, källor, SiteSettings, driftmeddelande, FAQ
    public const string Konto         = "Konto";          // spärra/återaktivera/radering/ångra-radering
    public const string Ärende        = "Ärende";         // öppnat/tilldelat/status/arkiverat
    public const string Push          = "Push";           // admin-utlöst push skickad
    public const string Registrering  = "Registrering";   // ny användare (System — citizen-initierad)
    public const string Säkerhet      = "Säkerhet";       // system, CSP-rapporter från webbläsare (V3-22)
}
