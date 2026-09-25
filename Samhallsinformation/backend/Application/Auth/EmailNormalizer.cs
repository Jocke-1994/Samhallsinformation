namespace Samhallsinformation.Application.Auth;

/// <summary>
/// Enda platsen för hur en e-postadress normaliseras (V2-11, beslut D6): trimmas och görs till
/// gemener. Används vid ALLA skrivningar (registrering, Google-inloggning, e-postbyte, admin-seed)
/// och alla uppslag (inloggning, glömt lösenord m.fl.), så att <c>Kalle@x.se</c> och
/// <c>kalle@x.se</c> är samma konto. Uppslag mot databasen jämför <c>u.Email.ToLower()</c> mot
/// det normaliserade värdet, så även äldre rader med versaler hittas.
/// </summary>
public static class EmailNormalizer
{
    /// <summary>Trimmar och gemenifierar. null blir tom sträng.</summary>
    public static string Normalize(string? email) =>
        (email ?? string.Empty).Trim().ToLowerInvariant();
}
