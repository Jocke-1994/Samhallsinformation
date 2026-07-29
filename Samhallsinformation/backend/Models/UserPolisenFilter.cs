namespace Samhallsinformation.Models;

// Polisen-specifikt filter (FAS 4, #298) — inte generellt per källa, eftersom
// bara Polisen har kategorier/kommuner att filtrera på just nu (EventType,
// PR #373). En rad per användare. Null-fälten betyder "ej anpassat" (allt),
// en JSON-array (även tom) betyder ett explicit valt urval.
public class UserPolisenFilter
{
    public Guid    UserId         { get; set; }
    public string? KategorierJson { get; set; }
    public string? OmradenJson    { get; set; }

    public User User { get; set; } = null!;
}
