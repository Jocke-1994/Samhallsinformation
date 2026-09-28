namespace Samhallsinformation.Application.Auth;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Enda platsen som avgör VEM som har spärrat ett konto, och skyddet mot att låsa ut alla admins.
///
/// Kontot har bara en spärr-kolumnuppsättning (IsActive/SuspendedAt/SuspendedReason), som delas av
/// två orsaker: en admins avstängning och en pågående raderingsbegäran (24 h-fönstret). Raderingen
/// markerar sin spärr med <see cref="DeletionReasonPrefix"/> i SuspendedReason (+ DeletionScheduledAt).
/// En admins avstängning skriver över texten, och därmed försvinner markören — då får varken
/// användarens ångra-länk eller DeleteMe röra spärren. Ingen ny kolumn/migrering behövs.
/// </summary>
public static class AccountSuspension
{
    public const string DeletionReasonPrefix = "Radering begärd";
    public const string UserDeletionReason  = DeletionReasonPrefix + " av användaren (GDPR) — raderas automatiskt om 24 timmar";
    public const string AdminDeletionReason = DeletionReasonPrefix + " (GDPR) — raderas automatiskt om 24 timmar om ingen avbryter det";

    private const string AdminRole = "Admin";

    /// <summary>Kontot är spärrat ENBART på grund av en schemalagd radering (ingen admin-spärr ovanpå).</summary>
    public static bool IsDeletionOnlySuspension(User user) =>
        !user.IsActive
        && user.DeletionScheduledAt != null
        && user.SuspendedReason != null
        && user.SuspendedReason.StartsWith(DeletionReasonPrefix, StringComparison.Ordinal);

    /// <summary>Kontot är spärrat av en admin (avstängt och inte bara "under radering"). Anonymiserade konton räknas inte.</summary>
    public static bool IsAdminSuspended(User user) =>
        !user.IsActive && user.DeletedAt == null && !IsDeletionOnlySuspension(user);

    /// <summary>
    /// True om <paramref name="user"/> är Admin och ingen ANNAN aktiv (ej spärrad, ej anonymiserad)
    /// Admin finns — dvs. att spärra/radera kontot skulle låsa ut alla admins.
    /// </summary>
    public static async Task<bool> IsLastActiveAdminAsync(AppDbContext db, User user)
    {
        if (user.Role != AdminRole || !user.IsActive || user.DeletedAt != null) return false;

        var otherActiveAdmins = await db.Users.AnyAsync(u =>
            u.Id != user.Id && u.Role == AdminRole && u.IsActive && u.DeletedAt == null);
        return !otherActiveAdmins;
    }
}
