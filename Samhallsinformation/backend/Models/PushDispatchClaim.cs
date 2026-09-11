namespace Samhallsinformation.Models;

// En rad per push-batch skickad till EN användares enheter (skapad i
// PushDispatcher.SendToDevicesAsync). Id:t skickas med i varje enhets push-
// payload som "claimId" — service workern (sw.js) claimar den innan den
// visar notisen, så bara den enhet som frågar FÖRST faktiskt visar den.
public class PushDispatchClaim
{
    public Guid     Id                { get; set; } = Guid.NewGuid();
    public Guid     UserId            { get; set; }
    public Guid?    ClaimedByDeviceId { get; set; }
    public DateTime? ClaimedAt        { get; set; }
    public DateTime CreatedAt         { get; set; } = DateTime.UtcNow;
}
