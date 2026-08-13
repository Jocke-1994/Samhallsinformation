namespace Samhallsinformation.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string toName, string resetLink);
    Task SendWelcomeAsync(string toEmail, string toName);
    Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink);
}
