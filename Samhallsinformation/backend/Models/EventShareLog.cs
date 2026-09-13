namespace Samhallsinformation.Models;

// En rad per klick på "Dela" (NewsItem.tsx) — ren analytics, ingen admin-
// åtgärd kopplad. UserId är null för utloggade/anonyma delningar, satt om
// JWT:n skickades med (UseAuthentication populerar User-claims oavsett om
// endpointen kräver [Authorize] eller ej).
public class EventShareLog
{
    public Guid     Id       { get; set; } = Guid.NewGuid();
    public Guid     EventId  { get; set; }
    public Guid?    UserId   { get; set; }
    public DateTime SharedAt { get; set; } = DateTime.UtcNow;
}
