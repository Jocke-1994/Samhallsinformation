namespace Samhallsinformation.Application.Monitoring;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Csp;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Larm när CSP (rapportera-läge, V3-22) rapporterar en oväntad SKRIPTKÄLLA — villkor 2 i alt C-bevakningen
/// (refresh-token i httpOnly-cookie, FIXPLAN P1). Ett larm per unik (direktiv, origin), alltså en gång per ny
/// typ av överträdelse. Bild-, font- och stilöverträdelser larmar inte (för mycket brus).
///
/// Larmet är sant så länge en skriptöverträdelse har loggats de senaste <see cref="Lookback"/>; AdminAlertCycle
/// löser det när träffarna uteblir. Fönstret är 25 h, inte 24: dedupen i CspReportService loggar en pågående
/// överträdelse på nytt först efter 24 h, och 1 h marginal gör att det gamla larmet aldrig hinner lösas och
/// öppnas igen (nytt mejl varje dygn) i glappet. Alltså löses larmet 24–25 h efter sista träffen.
///
/// Bara http(s)/ws(s)-origins larmar — "oväntad källa" är en adress. "inline", "eval" och "data" loggas men larmar
/// inte: index.html har medvetet inline-skript (tillåtna i policyn), och eval/data är inga externa skriptkällor.
/// </summary>
public sealed class CspViolationRule : IMonitoringRule
{
    public const string Id = "csp_violation";
    public static string KeyFor(CspViolation v) => $"{Id}:{v.Directive}:{v.Origin}";

    public static readonly TimeSpan Lookback = TimeSpan.FromHours(25);

    public string RuleId => Id;
    public bool OneShot => false;

    public async Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var since = nowUtc - Lookback;
        var rader = await db.AdminActivityLogs
            .AsNoTracking()
            .Where(l => l.Typ == LoggTyper.Säkerhet && l.Rubrik == CspLogFormat.Rubrik && l.Tid >= since)
            .Select(l => l.Detalj)
            .ToListAsync(ct);

        var result = new List<AlertCandidate>();
        var sedda = new HashSet<string>(StringComparer.Ordinal);
        foreach (var detalj in rader)
        {
            if (!CspLogFormat.TryParseDetalj(detalj, out var v)) continue;
            if (!CspLogFormat.IsScriptDirective(v.Directive)) continue;
            // Parsern ger antingen schema://värd (http/https/ws/wss) eller ett nyckelord utan "://" (inline, eval, data ...).
            if (!v.Origin.Contains("://", StringComparison.Ordinal)) continue;
            if (!sedda.Add(KeyFor(v))) continue;

            result.Add(new AlertCandidate(
                KeyFor(v),
                AlertSeverity.Warning,
                $"Oväntad skriptkälla rapporterad: {v.Origin}",
                $"Webbläsare rapporterar (CSP i rapportera-läge, {v.Directive}) att sidan försöker ladda skript från {v.Origin}, " +
                "som inte står på tillåtelselistan. Stämmer det med en ny källa ni själva lagt in? Annars kan det vara ett tecken på " +
                "injicerad kod. Se villkor 2 i alt C-bevakningen (Beslut - Alt C refresh-token i cookie). " +
                "Larmet löses av sig självt 24 h efter sista rapporten."));
        }
        return result;
    }
}
