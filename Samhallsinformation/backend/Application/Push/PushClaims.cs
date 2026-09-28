namespace Samhallsinformation.Application.Push;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// First-claim-wins för push-notiser: service workern (sw.js) frågar innan den
// visar en notis, och bara den enhet som frågar FÖRST får visa den.
public static class PushClaims
{
    // Returnerar true om DEN HÄR enheten ska visa notisen, false om en annan
    // enhet redan claimat den.
    //
    // Atomärt: en enda villkorad UPDATE (... WHERE Id = @id AND ClaimedAt IS NULL)
    // — databasen serialiserar konkurrerande anrop, så exakt ett får radantal 1.
    //
    // Okänt claimId (raden städad bort, eller skickad av en gammal version som
    // sparade raden först EFTER utskicket): vi väljer "hellre en notis för mycket
    // än en förlorad" men utan att ge upp dedupen. Är enheten en riktig, registrerad
    // enhet skapar vi raden nu, redan claimad av den — den första som frågar visar
    // notisen, och alla efterföljande får false (primärnyckeln på Id gör insättningen
    // atomär). Är enheten också okänd finns inget att dedupa mot (och ingen
    // användare att knyta raden till, så anonyma anrop kan inte fylla tabellen med
    // skräp) — då visas notisen (true).
    public static async Task<bool> TryClaimAsync(AppDbContext db, Guid claimId, Guid deviceId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var updated = await db.PushDispatchClaims
            .Where(c => c.Id == claimId && c.ClaimedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.ClaimedAt, now)
                .SetProperty(c => c.ClaimedByDeviceId, deviceId), ct);
        if (updated == 1) return true;

        // 0 rader: antingen redan claimad, eller okänt id.
        if (await db.PushDispatchClaims.AnyAsync(c => c.Id == claimId, ct)) return false;

        var userId = await db.UserDevices
            .Where(d => d.Id == deviceId)
            .Select(d => (Guid?)d.UserId)
            .FirstOrDefaultAsync(ct);
        if (userId == null) return true;

        db.PushDispatchClaims.Add(new PushDispatchClaim
        {
            Id = claimId, UserId = userId.Value, ClaimedAt = now, ClaimedByDeviceId = deviceId,
        });
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            // En annan enhet hann skapa raden först (PK-krock) — den vann.
            db.ChangeTracker.Clear();
            if (await db.PushDispatchClaims.AnyAsync(c => c.Id == claimId, ct)) return false;
            throw;
        }
    }
}
