namespace Samhallsinformation.Models;

public class CanonicalEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int SourceId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime PublishedAt { get; set; }
    public string Url { get; set; } = string.Empty;

    // Sparar originaldata för att uppfylla punkt 6 i din beskrivning
    public string RawData { get; set; } = string.Empty;
    public string? Geography { get; set; }
    public string? EventType { get; set; } // Källans egen händelsekategori, t.ex. Polisens "Misshandel"/"Trafikbrott" — underlag för framtida användarstyrd filtrering (FAS 4)
    public string Severity { get; set; } = "Bra att veta"; // Punkt 7 fallback
    public bool IsNational { get; set; }
    public DateTime IngestedAt { get; set; } = DateTime.UtcNow;
}