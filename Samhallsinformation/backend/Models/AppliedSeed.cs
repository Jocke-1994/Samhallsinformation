namespace Samhallsinformation.Models;

// Markör: "den här seed-/engångsuppdateringen har redan körts". Löser att en seed inte får
// köras om vid varje uppstart (skriva över adminens ändringar, återskapa raderade rader) —
// se FaqSeeder (V3-19). En rad per stabil seed-nyckel, t.ex. "faq_seed_konto_losenord".
//
// Medvetet en egen liten tabell: SiteSettings är en typad singleton (inte nyckel/värde) och
// FeatureFlagOverrides serveras publikt av GET /api/feature-flags och töms av "nollställ alla
// flaggor" — markörer där skulle både läcka och kunna raderas av misstag (=> seed skriver över).
public class AppliedSeed
{
    public string   Key       { get; set; } = "";
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
}
