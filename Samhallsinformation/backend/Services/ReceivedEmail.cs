namespace Samhallsinformation.Services;

/// <summary>
/// Ett inkommet mejl hämtat via Resends Received Emails-API (<c>GET /emails/receiving/{id}</c>).
/// <see cref="Text"/> är text/plain, eller html omvandlad till text när text saknas; null om båda är tomma.
/// </summary>
public sealed record ReceivedEmail(string? Text, ReceivedEmailAuthentication? Authentication);

/// <summary>
/// SPF/DKIM/DMARC-utfallet som Resends mottagande mejlserver räknat ut (inte något avsändaren kan skriva in
/// i mejlhuvudet). Värden enligt Resends dokumentation: pass, fail, gray, processing_failed, unknown.
/// Hela objektet är null i API-svaret för mejl som mottogs innan fältet infördes.
/// </summary>
public sealed record ReceivedEmailAuthentication(string? Spf, string? Dkim, string? Dmarc)
{
    /// <summary>
    /// Avsändarens From-domän är autentiserad: DMARC pass (SPF eller DKIM i linje med From-domänen), eller DKIM pass
    /// (Resend rapporterar "gray" när mejlet är osignerat eller signeringsdomänen inte matchar From-domänen — alltså
    /// betyder pass en signatur i linje med From). Enbart SPF pass räcker INTE: Resend anger inte om SPF-domänen
    /// (envelope-from) är i linje med From-headern, och en angripare kan låta SPF passera för sin egen domän.
    /// "gray" på DMARC (t.ex. Gmail, som publicerar p=none) räknas inte som pass — då avgör DKIM.
    /// </summary>
    public bool IsSenderVerified =>
        string.Equals(Dmarc, "pass", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Dkim, "pass", StringComparison.OrdinalIgnoreCase);

    public override string ToString() => $"spf={Spf ?? "-"}, dkim={Dkim ?? "-"}, dmarc={Dmarc ?? "-"}";
}
