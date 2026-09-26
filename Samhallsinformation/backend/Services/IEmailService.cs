namespace Samhallsinformation.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string toName, string resetLink);
    Task SendWelcomeAsync(string toEmail, string toName);
    Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink);

    // Skickas till DEN NYA adressen — bevisar ägarskap innan bytet slår igenom.
    Task SendEmailChangeConfirmationAsync(string toNewEmail, string toName, string confirmLink);

    // Skickas till DEN GAMLA adressen som en varningssignal — inget att klicka
    // på, bara en heads-up om att kontot håller på att byta bort den.
    Task SendEmailChangeNoticeAsync(string toOldEmail, string toName, string newEmail);

    // Skickas i samma ögonblick en radering (självbetjäning ELLER admin)
    // begärs — annars märker användaren bara att kontot är borta. Länken
    // bevisar identitet i sig (bara kontoägarens inkorg tar emot den),
    // ingen inloggning krävs för att klicka den.
    Task SendAccountDeletionScheduledAsync(string toEmail, string toName, string cancelLink, DateTime deletionScheduledAtUtc);

    // Agentsvar på ett supportärende. reply_to sätts till en plus-adress
    // (svar+{ticketNumber}-{token}@..., se TicketReplyAddress) — svarar mottagaren på mejlet landar det via
    // Resends inbound-webhook tillbaka i samma ärendetråd. fromAddress låter
    // svaret gå ut från samma adress ärendet kom in på (t.ex. info@) istället
    // för standard support@.
    Task SendTicketReplyAsync(string toEmail, int ticketNumber, string subject, string replyText, string? fromAddress = null);

    // Hämtar textinnehållet för ett inkommet mejl — webhooken levererar bara
    // metadata (avsändare/mottagare/id), själva texten hämtas separat.
    Task<string?> GetReceivedEmailTextAsync(string emailId);

    // Som ovan men även SPF/DKIM/DMARC-utfallet från Resends mottagande server (E1#10) —
    // används för att avgöra om avsändaren av ett svar på ett ärende går att lita på.
    // Null om mejlet inte kunde hämtas.
    Task<ReceivedEmail?> GetReceivedEmailAsync(string emailId);

    // Driftlarm från övervakningen (V1-9) till en admin. Ett mejl kan innehålla flera larm
    // (alla som blev nya/återöppnade i samma cykel) så en bred driftstörning inte ger ett mejl per källa.
    Task SendAdminAlertsAsync(string toEmail, string toName, IReadOnlyList<AdminAlertMailItem> alerts, string adminUrl);
}

/// <summary>Ett larm i ett driftlarmsmejl (V1-9).</summary>
public sealed record AdminAlertMailItem(string Severity, string Title, string Detail, DateTime RaisedAtUtc);
