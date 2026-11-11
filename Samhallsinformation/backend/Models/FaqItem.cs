namespace Samhallsinformation.Models;

public class FaqItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Kategori { get; set; } = "";
    public bool Publicerad { get; set; } = true;
    public string Fraga { get; set; } = "";
    public string Svar { get; set; } = "";
    /// <summary>
    /// Valfri koppling till en FlagKey i frontendens featureFlags.ts. När satt
    /// döljs frågan automatiskt i FaqKort.tsx om flaggan är inaktiv, utöver
    /// den vanliga Publicerad-filtreringen. Filtreringen sker i frontend,
    /// eftersom flaggornas defaultAktiv-värden bara finns där — backend
    /// känner bara till admins avvikelser (FeatureFlagOverrides).
    /// </summary>
    public string? FlagKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>
    /// Sätts om vid varje redigering (CreateFaq/UpdateFaq) — låter en extern
    /// konsument (t.ex. kundtjänstboten, se docs/vault/Ideer/FAQ-synk-
    /// kundtjanstbot.md) fråga "vad har ändrats sedan sist" istället för att
    /// hämta om hela listan varje gång.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
