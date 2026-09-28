namespace Samhallsinformation.Application.Auth;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>
/// Startup-datafix (V2-11, beslut D6): gemenifierar och trimmar befintliga e-postadresser i
/// <c>Users</c> så att de matchar <see cref="EmailNormalizer"/>. Körs efter migreringarna vid
/// varje uppstart och är idempotent (en andra körning hittar inget att ändra).
///
/// Skydd mot krock: innan något skrivs kontrolleras om normaliseringen skulle göra två (eller
/// fler) konton till samma adress. Gör den det AVBRYTS hela datafixen — ingen rad ändras — och
/// exakt vilka konton (id + adress) som krockar loggas som Warning. Ingen tyst sammanslagning
/// och ingen krasch; en människa får avgöra vilket konto som ska behållas. Datafixen försöker
/// om vid nästa uppstart, och tills dess fungerar allt som förut (uppslagen är
/// skiftlägesokänsliga oavsett om raderna hunnit gemenifieras).
///
/// Skrivningen sker i en transaktion (allt eller inget). Ingen EF-migrering behövs.
/// </summary>
public static class EmailNormalizationDataFix
{
    public record Conflict(Guid UserId, string Email);

    public record Result(bool Aborted, int Updated, IReadOnlyList<Conflict> Conflicts);

    public static async Task<Result> RunAsync(AppDbContext db, ILogger logger)
    {
        var users = await db.Users.ToListAsync();

        // Grupper som skulle bli samma adress efter normalisering (även om raderna är olika idag).
        var conflictGroups = users
            .GroupBy(u => EmailNormalizer.Normalize(u.Email))
            .Where(g => g.Count() > 1)
            .ToList();

        if (conflictGroups.Count > 0)
        {
            var conflicts = conflictGroups
                .SelectMany(g => g.OrderBy(u => u.CreatedAt).Select(u => new Conflict(u.Id, u.Email)))
                .ToList();

            var detaljer = string.Join("; ", conflictGroups.Select(g =>
                $"{g.Key}: " + string.Join(", ", g.OrderBy(u => u.CreatedAt).Select(u => $"{u.Id} ('{u.Email}')"))));

            logger.LogWarning(
                "E-postnormaliseringen avbröts: {Antal} adress(er) skulle bli dubbletter och INGET har ändrats. " +
                "Lös krockarna manuellt (slå ihop eller ta bort ett av kontona) — datafixen försöker igen vid nästa uppstart. " +
                "Krockande konton: {Detaljer}",
                conflictGroups.Count, detaljer);

            return new Result(Aborted: true, Updated: 0, Conflicts: conflicts);
        }

        var attAndra = users.Where(u => u.Email != EmailNormalizer.Normalize(u.Email)).ToList();
        if (attAndra.Count == 0)
            return new Result(Aborted: false, Updated: 0, Conflicts: []);

        await using var tx = await db.Database.BeginTransactionAsync();
        foreach (var u in attAndra)
            u.Email = EmailNormalizer.Normalize(u.Email);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        logger.LogInformation("E-postnormalisering: {Antal} adress(er) gemenifierade.", attAndra.Count);
        return new Result(Aborted: false, Updated: attAndra.Count, Conflicts: []);
    }
}
