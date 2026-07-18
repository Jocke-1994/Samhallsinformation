namespace Samhallsinformation.Application.Auth;

using Samhallsinformation.Models;

public interface ITokenService
{
    string GenerateAccessToken(User user);

    (string RawToken, string TokenHash) GenerateRefreshToken();

    string HashToken(string rawToken);
}
