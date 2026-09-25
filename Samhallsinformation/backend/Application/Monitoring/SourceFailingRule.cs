namespace Samhallsinformation.Application.Monitoring;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Larm per aktiv, publicerad källa som (a) misslyckats N cykler i rad enligt IngestorRunLog, eller
/// (b) inte hämtats på över X minuter (Source.LastFetchedAt sätts bara vid lyckad hämtning, så en
/// källa som fallerar utan att loggen hunnit fylla N rader fångas också här). Sandlådekällor
/// (IsPublished=false) och pausade källor (IsActive=false) larmar inte — de är medvetet under test/pausade.
/// En källa som aldrig hämtats (LastFetchedAt=null) larmar bara via felföljden, inte via "inte hämtad".
/// Ett enstaka fel (Source.LastFetchError satt efter en enda misslyckad cykel) larmar inte — det är
/// vanligt med en tillfällig timeout och skulle ge mejlbrus.
/// </summary>
public sealed class SourceFailingRule : IMonitoringRule
{
    public const string Id = "source_failing";
    public static string KeyFor(int sourceId) => $"{Id}:{sourceId}";

    private readonly MonitoringOptions _options;
    public SourceFailingRule(MonitoringOptions options) => _options = options;

    public string RuleId => Id;
    public bool OneShot => false;

    public async Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var källor = await db.Sources
            .AsNoTracking()
            .Where(s => s.IsActive && s.IsPublished)
            .ToListAsync(ct);

        var result = new List<AlertCandidate>();
        foreach (var källa in källor)
        {
            var orsaker = new List<string>();

            var senaste = await db.IngestorRunLogs
                .AsNoTracking()
                .Where(l => l.SourceId == källa.Id)
                .OrderByDescending(l => l.RunAt)
                .Take(_options.SourceFailStreak)
                .ToListAsync(ct);
            if (senaste.Count >= _options.SourceFailStreak && senaste.All(l => !l.Success))
            {
                var fel = senaste[0].ErrorMessage ?? källa.LastFetchError;
                orsaker.Add($"{_options.SourceFailStreak} misslyckade hämtningar i rad" +
                            (string.IsNullOrWhiteSpace(fel) ? "." : $". Senaste fel: {Kort(fel)}"));
            }

            if (källa.LastFetchedAt is { } senastHämtad
                && nowUtc - senastHämtad > TimeSpan.FromMinutes(_options.SourceStaleMinutes))
            {
                var min = (int)(nowUtc - senastHämtad).TotalMinutes;
                orsaker.Add($"Inte hämtad på {min} min (gräns {_options.SourceStaleMinutes} min).");
            }

            if (orsaker.Count == 0) continue;

            result.Add(new AlertCandidate(
                KeyFor(källa.Id),
                AlertSeverity.Critical,
                $"Källan \"{källa.Name}\" fungerar inte",
                string.Join(" ", orsaker)));
        }
        return result;
    }

    private static string Kort(string s) => s.Length > 200 ? s[..200] + "…" : s;
}
