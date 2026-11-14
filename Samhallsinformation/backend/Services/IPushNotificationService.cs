namespace Samhallsinformation.Services;

using Samhallsinformation.Models;

// Gör att flera pushar om samma sak slås ihop till EN notis på enheten
// i stället för en lista (service workern, public/sw.js). Det behövs framför
// allt när en enhet varit avstängd: pushtjänsten levererar då alla pushar som
// köats under TTL:en på en gång, en per ingestor-körning (var 5:e minut).
// Tag = vad som slås ihop (t.ex. en källa), Antal = händelser i just den här
// pushen, Etikett = slutet på den summerade texten ("{summa} nya händelser
// {Etikett}"), Url = länken när notisen gäller fler än en händelse.
public sealed record PushGrupp(string Tag, int Antal, string Etikett, string Url);

public interface IPushNotificationService
{
    // Kastar WebPush.WebPushException vid leveransfel — anroparen ansvarar för
    // att tolka statuskoden (t.ex. 404/410 = subskriptionen är död).
    // claimId: om satt, skickas med i payloaden så service workern kan fråga
    // /api/push/claim innan den visar notisen — bara den enhet som claimar
    // FÖRST visar den, se PushDispatchClaim.
    // grupp: om satt, slår service workern ihop notisen med en redan visad
    // notis med samma tag och summerar antalet, se PushGrupp.
    Task SendAsync(UserDevice device, string title, string body, string? url, Guid? claimId = null, PushGrupp? grupp = null, CancellationToken ct = default);
}
