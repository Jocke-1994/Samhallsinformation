namespace Samhallsinformation.Application.Support;

using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Models;

/// <summary>
/// Vad som ska levereras. <see cref="Scheduled"/> och <see cref="AktörTyp"/> påverkar
/// bara texten/aktören i aktivitetsloggen — själva leveransen (spara, mejla) är identisk.
/// </summary>
public record SupportReplyDeliveryRequest(
    SupportTicket Ticket,
    Guid AuthorUserId,
    string Text,
    bool IsInternal,
    string AktörTyp = AktörTyper.Admin,
    bool Scheduled = false);

/// <summary>
/// EN gemensam väg för ett agentsvar på ett supportärende: spara meddelandet, uppdatera
/// ärendet, mejla medborgaren (om svaret inte är internt och en adress finns) och skriv
/// aktivitetslogg. Används av både <c>AdminSupportController.Reply</c> och den schemalagda
/// åtgärden "svar" så att de aldrig glider isär (E3 #2).
/// </summary>
public interface ISupportReplyDelivery
{
    /// <param name="beforeSave">
    /// Körs precis innan meddelandet sparas, i samma <c>SaveChanges</c>. Används av den
    /// schemalagda åtgärden för att markera sig själv som utförd atomärt tillsammans med
    /// meddelandet — mejlet skickas först efter att båda är sparade, så ett mejlfel eller en
    /// omkörning kan aldrig ge ett dubbelt utskick.
    /// </param>
    Task DeliverAsync(SupportReplyDeliveryRequest request, Action? beforeSave = null, CancellationToken ct = default);
}
