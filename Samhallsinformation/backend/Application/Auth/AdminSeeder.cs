namespace Samhallsinformation.Application.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Seedar admin-kontot från ADMIN_EMAIL/ADMIN_PASSWORD vid uppstart (utbruten ur Program.cs så att
/// den går att testa). Skapar bara kontot om adressen inte redan finns (skiftlägesokänsligt).
/// Adressen är normaliserad och kontot skapas som e-postverifierat — adminen äger per definition adressen.
/// </summary>
public static class AdminSeeder
{
    public static async Task<bool> EnsureAdminAsync(AppDbContext db, string? email, string? password, string name)
    {
        var normalized = EmailNormalizer.Normalize(email);
        if (string.IsNullOrEmpty(normalized) || string.IsNullOrEmpty(password))
            return false;

        if (await db.Users.AnyAsync(u => u.Email.ToLower() == normalized))
            return false;

        var admin = new User
        {
            Email         = normalized,
            Name          = name,
            Role          = "Admin",
            EmailVerified = true,
        };
        admin.PasswordHash = new PasswordHasher<User>().HashPassword(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        return true;
    }
}
