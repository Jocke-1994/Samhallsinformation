namespace Samhallsinformation.Models;

public class Uppdatering
{
    public Guid     Id         { get; set; } = Guid.NewGuid();
    public string   Titel      { get; set; } = "";
    public DateTime Datum      { get; set; }
    public bool     Publicerad { get; set; } = false;
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt  { get; set; } = DateTime.UtcNow;
}
