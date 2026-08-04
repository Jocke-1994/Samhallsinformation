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
}
