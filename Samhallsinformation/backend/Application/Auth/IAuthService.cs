namespace Samhallsinformation.Application.Auth;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string name, string email, string password, bool acceptedTerms);

    Task<AuthResult> LoginAsync(string email, string password);

    Task<AuthResult> GoogleLoginAsync(string idToken, bool acceptedTerms);

    Task<AuthResult> RefreshAsync(string refreshToken);

    Task<AuthResult> LogoutAsync(string refreshToken);

    Task<AuthResult> RequestPasswordResetAsync(string email);

    Task<AuthResult> ResetPasswordAsync(string token, string newPassword);

    Task<AuthResult> VerifyEmailAsync(string token);

    Task<AuthResult> ResendVerificationAsync(Guid userId);

    // Skickar en bekräftelselänk till den NYA adressen — kontots e-post byts
    // inte förrän ConfirmEmailChangeAsync anropas med en giltig token. Kräver
    // nuvarande lösenord för lösenordskonton — en redan inloggad session ska
    // inte ensam räcka för att kapa kontot till en ny adress.
    Task<AuthResult> RequestEmailChangeAsync(Guid userId, string newEmail, string? currentPassword);

    Task<AuthResult> ConfirmEmailChangeAsync(string token);

    Task<AuthResult> CancelEmailChangeAsync(Guid userId);
}
