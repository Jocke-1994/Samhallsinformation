namespace Samhallsinformation.Models;

// "Sparat" (session 24) — en användare bokmärker en enskild händelse, oavsett
// källa, för att hitta den igen senare. Unikt index (UserId, EventId) gör att
// samma händelse aldrig kan sparas två gånger av samma användare.
public class UserSavedEvent
{
    public Guid Id      { get; set; } = Guid.NewGuid();
    public Guid UserId  { get; set; }
    public Guid EventId { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;

    public User           User  { get; set; } = null!;
    public CanonicalEvent Event { get; set; } = null!;
}
