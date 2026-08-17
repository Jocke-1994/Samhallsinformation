namespace Samhallsinformation.Models;

// En rad per käll-försök i varje ingestor-cykel (IngestorBackgroundService,
// var 5:e minut) — grunden för "Fel senaste 7 dagarna" (Rapporter) och
// Ingestor/Fel-raderna i Aktivitetslogg, som tidigare var ren mockdata.
public class IngestorRunLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int SourceId { get; set; }
    public DateTime RunAt { get; set; } = DateTime.UtcNow;
    public bool Success { get; set; }
    public int EventsInserted { get; set; }
    public string? ErrorMessage { get; set; }
}
