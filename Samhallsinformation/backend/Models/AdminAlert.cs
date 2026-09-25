namespace Samhallsinformation.Models;

// Ett larm från övervakningen (V1-9, MonitoringService). En rad per Key
// (t.ex. "users_threshold", "source_failing:12") — ett larm som slutar gälla
// får ResolvedAt, och om problemet återkommer öppnas SAMMA rad igen (ny
// FirstRaisedAt, antal och kvittering nollställs, mejl skickas på nytt).
public class AdminAlert
{
    public Guid   Id     { get; set; } = Guid.NewGuid();

    // Regelns id ("users_threshold", "source_failing", "push_failures") och en
    // unik nyckel per larm (regel-id + ev. objekt, t.ex. "source_failing:12").
    public string RuleId { get; set; } = string.Empty;
    public string Key    { get; set; } = string.Empty;

    // "info" | "warning" | "critical" — se AlertSeverity.
    public string Severity { get; set; } = AlertSeverity.Warning;
    public string Title    { get; set; } = string.Empty;
    public string Detail   { get; set; } = string.Empty;

    public DateTime FirstRaisedAt   { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt      { get; set; } = DateTime.UtcNow;
    public int      OccurrenceCount { get; set; } = 1; // antal utvärderingscykler larmet varit aktivt

    public DateTime? AcknowledgedAt { get; set; }
    public string?   AcknowledgedBy { get; set; }
    public DateTime? ResolvedAt     { get; set; }

    // När larmmejlet lyckades gå ut. null = ännu inte skickat (nytt/återöppnat,
    // eller alla försök misslyckades) — cykeln försöker igen tills det lyckas.
    public DateTime? NotifiedAt { get; set; }
}

public static class AlertSeverity
{
    public const string Info     = "info";
    public const string Warning  = "warning";
    public const string Critical = "critical";

    public static int Rank(string severity) => severity switch
    {
        Critical => 0,
        Warning  => 1,
        _        => 2,
    };
}
