namespace Samhallsinformation.Application.Auth;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string name, string email, string password);

    Task<AuthResult> LoginAsync(string email, string password);

    Task<AuthResult> RefreshAsync(string refreshToken);

    Task<AuthResult> LogoutAsync(string refreshToken);

    Task<AuthResult> RequestPasswordResetAsync(string email);

    Task<AuthResult> ResetPasswordAsync(string token, string newPassword);
}
