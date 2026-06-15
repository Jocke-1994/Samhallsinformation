namespace Samhallsinformation.Controllers;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly string _jwtSecret;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db        = db;
        _jwtSecret = config["JWT_SECRET"] ?? "dev-secret-change-in-production-at-least-32-chars";
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        var user = _db.Users.FirstOrDefault(u => u.Email == req.Email);
        if (user == null)
            return Unauthorized(new { error = "Felaktigt e-post eller lösenord" });

        var hasher = new PasswordHasher<User>();
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Felaktigt e-post eller lösenord" });

        var token = GenerateToken(user);
        return Ok(new { token, name = user.Name, role = user.Role });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var name  = User.FindFirstValue("name");
        var role  = User.FindFirstValue("role");
        return Ok(new { email, name, role });
    }

    private string GenerateToken(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new Claim(ClaimTypes.Email,              user.Email),
            new Claim("name",                        user.Name),
            new Claim("role",                        user.Role),
        };

        var token = new JwtSecurityToken(
            claims:            claims,
            expires:           DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
