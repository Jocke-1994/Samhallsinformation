namespace Samhallsinformation.Models;

// Singleton-rad (Id = 1) — global adminstyrd inställning som gäller ALLA
// besökare, till skillnad från frontendens per-webbläsare localStorage-flaggor
// i lib/featureFlags.ts. Se PR-beskrivning: admin trodde tidigare att
// Logga in/Skapa konto-knapparna styrdes globalt när de bara var lokala.
public class SiteSettings
{
    public int  Id                 { get; set; }
    public bool ShowLoginButton    { get; set; } = true;
    public bool ShowRegisterButton { get; set; } = true;
}
