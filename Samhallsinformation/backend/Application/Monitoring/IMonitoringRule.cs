namespace Samhallsinformation.Application.Monitoring;

using Samhallsinformation.Data;

/// <summary>Ett larm som en regel anser gäller just nu.</summary>
public sealed record AlertCandidate(string Key, string Severity, string Title, string Detail);

/// <summary>
/// En övervakningsregel (V1-9). Varje regel är en liten klass som, givet databasen och en klocka,
/// returnerar de larm som gäller NU. Regeln skapar/löser aldrig larm själv — det gör
/// <see cref="AdminAlertCycle"/>, så dedupe, återöppning och mejl är samma för alla regler.
/// </summary>
public interface IMonitoringRule
{
    /// <summary>Stabilt id, sparas i AdminAlert.RuleId.</summary>
    string RuleId { get; }

    /// <summary>
    /// true = larmar EN gång: finns redan en rad för nyckeln (öppen, kvitterad eller löst) rörs den
    /// aldrig igen, och kvittering stänger larmet för gott. Används för milstolpar som
    /// användartröskeln, där "under tröskeln igen" inte betyder att frågan är avgjord.
    /// </summary>
    bool OneShot { get; }

    Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct);
}
