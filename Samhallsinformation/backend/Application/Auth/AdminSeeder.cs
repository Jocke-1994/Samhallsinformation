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
    public static async Task<bool> EnsureAdminAsync(
        AppDbContext db, string? email, string? password, string name, ILogger? logger = null)
    {
        var normalized = EmailNormalizer.Normalize(email);
        if (string.IsNullOrEmpty(normalized) || string.IsNullOrEmpty(password))
            return false;

        var existingRole = await db.Users
            .Where(u => u.Email.ToLower() == normalized)
            .Select(u => u.Role)
            .FirstOrDefaultAsync();
        if (existingRole != null)
        {
            // V4-1a (E2#8): kontot finns redan (t.ex. registrerat före första start i en ny miljö). Rollen ändras
            // ALDRIG automatiskt — men tyst är fel: då fungerar inloggningen som vanlig användare utan att någon ser varför.
            if (existingRole != "Admin")
                logger?.LogWarning(
                    "ADMIN_EMAIL pekar på ett konto utan Admin-roll (rollen är \"{Role}\") — ingen admin skapad/uppgraderad. " +
                    "Ändra rollen manuellt om kontot ska vara admin.", existingRole);
            return false;
        }

        var admin = new User
        {
            Email = normalized,
            Name = name,
            Role = "Admin",
            EmailVerified = true,
        };
        admin.PasswordHash = new PasswordHasher<User>().HashPassword(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        return true;
    }
}
