namespace Samhallsinformation.Infrastructure.Auth;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Models;

public class JwtTokenService : ITokenService
{
    private static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);

    private readonly string _jwtSecret;

    public JwtTokenService(IConfiguration config)
    {
        _jwtSecret = config["JWT_SECRET"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? "dev-secret-change-in-production-at-least-32-chars";
    }

    public string GenerateAccessToken(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier,   user.Id.ToString()),
            new Claim(ClaimTypes.Email,            user.Email),
            new Claim("name",                       user.Name),
            new Claim("role",                       user.Role),
        };

        var token = new JwtSecurityToken(
            claims:             claims,
            expires:            DateTime.UtcNow.Add(AccessTokenLifetime),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string RawToken, string TokenHash) GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var raw   = Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return (raw, HashToken(raw));
    }

    public string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }
}
