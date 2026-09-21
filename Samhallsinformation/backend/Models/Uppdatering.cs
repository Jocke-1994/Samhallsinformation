namespace Samhallsinformation.Models;

public class Uppdatering
{
    public Guid     Id         { get; set; } = Guid.NewGuid();
    public string   Titel      { get; set; } = "";
    public DateTime Datum      { get; set; }
    public bool     Publicerad { get; set; } = false;
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt  { get; set; } = DateTime.UtcNow;

    // Satt när posten schemaläggs istället för att publiceras direkt.
    // ScheduledReleaseBackgroundService nollställer detta när den är klar
    // (bearbetad), oavsett om Publicerad faktiskt blev true eller ej.
    public DateTime? SchemalagdPubliceringUtc { get; set; }

    // JSON string[] av feature-flag-nycklar som ska aktiveras (Value=true)
    // samtidigt som schemat slår in — samma JSON-kolumn-mönster som
    // UserPolisenFilter.KategorierJson. Serialiseras i controllern.
    public string? SchemalagdaFlaggorJson { get; set; }
}
