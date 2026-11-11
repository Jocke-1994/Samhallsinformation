namespace Samhallsinformation.Models;

// Ersätter UserPolisenFilter (en rad per användare, en enda AND-kombination)
// med flera oberoende bevakningar per användare, ELLER-kombinerade — se
// PolisenBevakningMatcher.Matches. Null-fälten betyder "ej begränsat" (alla
// typer/områden), en JSON-array (även tom) betyder ett explicit urval.
public class PolisenBevakning
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string? KategorierJson { get; set; }
    public string? OmradenJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
