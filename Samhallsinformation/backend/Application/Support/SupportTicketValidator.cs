namespace Samhallsinformation.Application.Support;

using System.Net.Mail;

/// <summary>
/// Indatavalidering för anonymt/inloggat skapande av supportärenden
/// (<c>POST /api/support/tickets</c>). Endpointen är öppen för anonyma, så
/// varje fält måste ha en övre gräns och Channel/Category en allowlist —
/// annars kan en angripare fylla databasen och skicka tredje part e-post via
/// adminsvar (E1 #8).
/// </summary>
public static class SupportTicketValidator
{
    public const int MaxSubjectLength = 200;
    public const int MaxMessageLength = 5000;
    public const int MaxNameLength    = 100;
    public const int MaxEmailLength   = 254; // RFC 5321

    // Kanaler klienter får ange. "info-mejl" ingår avsiktligt INTE: den sätts
    // bara av WebhooksController (inbound-mejl) och styr trådmatchningen där.
    public static readonly IReadOnlySet<string> AllowedChannels =
        new HashSet<string>(StringComparer.Ordinal) { "arendehantering", "feedback", "kundtjanstbot" };

    // Kategorierna i ArendehanteringKort.tsx (KATEGORIER) + "Feedback", som är
    // standardvärdet när kategori utelämnas (feedback-knappen och kundtjänstboten).
    public static readonly IReadOnlySet<string> AllowedCategories =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Feedback", "Notifieringar", "Inloggning", "GDPR & uppgifter",
            "Konto", "Tekniskt fel", "Önskemål", "Testare", "Annat",
        };

    /// <summary>Returnerar ett svenskt felmeddelande, eller null om indatan är giltig.</summary>
    public static string? Validate(string? subject, string? category, string? message, string? channel, string? contactName, string? contactEmail)
    {
        if (string.IsNullOrWhiteSpace(message))
            return "Message krävs.";
        if (message.Trim().Length > MaxMessageLength)
            return $"Meddelandet får vara högst {MaxMessageLength} tecken.";

        if (!string.IsNullOrWhiteSpace(subject) && subject.Trim().Length > MaxSubjectLength)
            return $"Ämnet får vara högst {MaxSubjectLength} tecken.";

        if (!string.IsNullOrWhiteSpace(contactName) && contactName.Trim().Length > MaxNameLength)
            return $"Namnet får vara högst {MaxNameLength} tecken.";

        if (!string.IsNullOrWhiteSpace(contactEmail))
        {
            var email = contactEmail.Trim();
            if (email.Length > MaxEmailLength)
                return $"E-postadressen får vara högst {MaxEmailLength} tecken.";
            if (!IsValidEmail(email))
                return "Ogiltig e-postadress.";
        }

        if (string.IsNullOrWhiteSpace(channel) || !AllowedChannels.Contains(channel))
            return "Okänd kanal.";

        if (!string.IsNullOrWhiteSpace(category) && !AllowedCategories.Contains(category.Trim()))
            return "Okänd kategori.";

        return null;
    }

    // MailAddress accepterar även "Namn <a@b.se>" och adresser utan punkt i
    // domänen — kräv att den parsade adressen är identisk med indatan och att
    // domänen har en punkt, så bara rena adresser släpps igenom.
    public static bool IsValidEmail(string email)
    {
        if (!MailAddress.TryCreate(email, out var addr)) return false;
        return addr.Address == email && addr.Host.Contains('.');
    }
}
