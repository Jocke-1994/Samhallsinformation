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
}
