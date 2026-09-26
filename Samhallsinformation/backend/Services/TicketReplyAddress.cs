namespace Samhallsinformation.Services;

using System.Globalization;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Ärendets svarsadress: <c>svar+{ticketnummer}-{token}@samhallsinformation.se</c> (E1#10).
/// Ticketnumret är ett löpande heltal och därmed gissningsbart — <c>token</c> är de första 8 hex-tecknen av
/// HMAC-SHA256(ärendenumret) med en nyckel som härleds ur JWT-hemligheten med en egen kontext-sträng
/// (så samma hemlighet aldrig används rakt av för två syften, och JWT-signeringen inte kan återanvändas
/// för att förfalska en svarsadress). Bara den som fått ett utgående mejl känner adressen.
/// Hemligheten loggas aldrig. Byte av JWT_SECRET ogiltigförklarar token i redan utskickade mejl
/// (svar på dem avvisas då) — samma sak som att alla sessioner loggas ut vid ett byte.
/// </summary>
public sealed class TicketReplyAddress
{
    public const string Domän = "samhallsinformation.se";
    public const int TokenLängd = 8;
    private const string KontextSträng = "samhallsinformation/ticket-reply-address/v1";

    private readonly byte[] _nyckel;

    public TicketReplyAddress(string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
            throw new ArgumentException("Hemligheten får inte vara tom.", nameof(secret));
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        _nyckel = hmac.ComputeHash(Encoding.UTF8.GetBytes(KontextSträng));
    }

    /// <summary>Token (8 små hex-tecken) för ett ärendenummer.</summary>
    public string ComputeToken(int ticketNumber)
    {
        using var hmac = new HMACSHA256(_nyckel);
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes(ticketNumber.ToString(CultureInfo.InvariantCulture)));
        return Convert.ToHexString(mac)[..TokenLängd].ToLowerInvariant();
    }

    /// <summary>Hela svarsadressen med token, t.ex. <c>svar+12-a1b2c3d4@samhallsinformation.se</c>.</summary>
    public string Build(int ticketNumber) => $"svar+{ticketNumber}-{ComputeToken(ticketNumber)}@{Domän}";

    /// <summary>
    /// Konstanttidsjämförelse. Skiftlägesokänslig (en mejlserver kan gemenifiera adressen). Null/tom/fel längd = ogiltig.
    /// </summary>
    public bool IsValid(int ticketNumber, string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length != TokenLängd) return false;
        var förväntad = Encoding.UTF8.GetBytes(ComputeToken(ticketNumber));
        var given = Encoding.UTF8.GetBytes(token.ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(förväntad, given);
    }
}
