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

    // Agentsvar på ett supportärende. reply_to sätts till en plus-adress
    // (svar+{ticketNumber}@...) — svarar mottagaren på mejlet landar det via
    // Resends inbound-webhook tillbaka i samma ärendetråd.
    Task SendTicketReplyAsync(string toEmail, int ticketNumber, string subject, string replyText);

    // Hämtar textinnehållet för ett inkommet mejl — webhooken levererar bara
    // metadata (avsändare/mottagare/id), själva texten hämtas separat.
    Task<string?> GetReceivedEmailTextAsync(string emailId);
}
