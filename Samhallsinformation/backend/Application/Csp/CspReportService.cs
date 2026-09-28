namespace Samhallsinformation.Application.Csp;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>Hur en CSP-överträdelse ser ut som rad i AdminActivityLog — delas av tjänsten (skriver) och larmregeln (läser).</summary>
public static class CspLogFormat
{
    public const string Rubrik = "CSP-överträdelse (rapportera-läge)";

    /// <summary>Hur långt tillbaka samma (direktiv, origin) räknas som redan loggad.</summary>
    public static readonly TimeSpan DedupeWindow = TimeSpan.FromHours(24);

    public static string Detalj(CspViolation v) => $"{v.Directive}: {v.Origin}";

    public static bool TryParseDetalj(string? detalj, out CspViolation violation)
    {
        violation = default!;
        if (detalj == null) return false;
        var i = detalj.IndexOf(": ", StringComparison.Ordinal);
        if (i <= 0 || i + 2 >= detalj.Length) return false;
        violation = new CspViolation(detalj[..i], detalj[(i + 2)..]);
        return true;
    }

    /// <summary>script-src och script-src-elem: en oväntad SKRIPTKÄLLA (villkor 2 i alt C-bevakningen).</summary>
    public static bool IsScriptDirective(string directive) => directive is "script-src" or "script-src-elem";
}

public interface ICspReportService
{
    /// <summary>
    /// Läser en (begränsad) rapportbody och sparar nya, unika överträdelser. Kastar aldrig — endpointen
    /// ska alltid svara 204, hur trasig rapporten eller databasen än är. Returnerar antal NYA loggrader.
    /// </summary>
    Task<int> HandleAsync(Stream body, long? contentLength, CancellationToken ct);
}

/// <summary>
/// Tar emot CSP-rapporter (V3-22, alt B i D4: CSP i rapportera-läge). Sparar en sammanfattning per unik
/// (direktiv, origin) i AdminActivityLog (Typ "Säkerhet") — ingen ny tabell.
///
/// Skydd mot att en anonym endpoint fyller databasen:
///  - Bodyn läses begränsad till <see cref="MaxBodyBytes"/>; större bodyer slängs oläst (svar 204 ändå).
///  - Dedupe: samma (direktiv, origin) loggas högst en gång per <see cref="CspLogFormat.DedupeWindow"/>.
///  - Tak: högst <see cref="MaxScriptRowsPerWindow"/> skriptrader och <see cref="MaxOtherRowsPerWindow"/> övriga rader per
///    fönster. Skript har ett eget tak så att en översvämning av bild-/font-brus aldrig kan tränga undan
///    en skriptkälla (den som larmregeln bryr sig om).
///  - Rate limit på endpointen (policy "csp-report", se CspReportRateLimit) ligger utanför tjänsten.
/// Ingen persondata: raden får Ip = null och Enhet = null (till skillnad från IAktivitetsloggService, som
/// automatiskt fångar IP och User-Agent), och bara origin + direktiv sparas.
/// Samtidiga identiska rapporter kan i sällsynta fall ge en dubblettrad (inget unikt index) — harmlöst.
/// </summary>
public sealed class CspReportService : ICspReportService
{
    public const int MaxBodyBytes = 8 * 1024;
    public const int MaxScriptRowsPerWindow = 25;
    public const int MaxOtherRowsPerWindow = 25;

    private readonly AppDbContext _db;
    private readonly TimeProvider _time;
    private readonly ILogger<CspReportService> _logger;

    public CspReportService(AppDbContext db, TimeProvider time, ILogger<CspReportService> logger)
    {
        _db = db;
        _time = time;
        _logger = logger;
    }

    public async Task<int> HandleAsync(Stream body, long? contentLength, CancellationToken ct)
    {
        try
        {
            var text = await ReadBoundedAsync(body, contentLength, ct);
            if (text == null) return 0;

            var violations = CspReportParser.Parse(text);
            if (violations.Count == 0) return 0;

            return await RecordAsync(violations, ct);
        }
        catch (OperationCanceledException)
        {
            return 0; // klienten avbröt — inget att logga
        }
        catch (Exception ex)
        {
            // En trasig rapport (eller ett databasfel) får aldrig ge 500 — det är bara en rapport.
            _logger.LogWarning(ex, "CSP-rapport kunde inte hanteras");
            return 0;
        }
    }

    private async Task<int> RecordAsync(IReadOnlyList<CspViolation> violations, CancellationToken ct)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var since = now - CspLogFormat.DedupeWindow;

        var recent = await _db.AdminActivityLogs
            .AsNoTracking()
            .Where(l => l.Typ == LoggTyper.Säkerhet && l.Rubrik == CspLogFormat.Rubrik && l.Tid >= since)
            .Select(l => l.Detalj)
            .ToListAsync(ct);

        var known = new HashSet<string>(recent, StringComparer.Ordinal);
        var scriptRows = recent.Count(d => CspLogFormat.TryParseDetalj(d, out var v) && CspLogFormat.IsScriptDirective(v.Directive));
        var otherRows = recent.Count - scriptRows;

        var added = 0;
        foreach (var v in violations)
        {
            var detalj = CspLogFormat.Detalj(v);
            if (known.Contains(detalj)) continue; // samma överträdelse redan loggad i fönstret

            var isScript = CspLogFormat.IsScriptDirective(v.Directive);
            if (isScript ? scriptRows >= MaxScriptRowsPerWindow : otherRows >= MaxOtherRowsPerWindow)
                continue; // taket nått — släng tyst (varning loggas inte per rapport, det vore själv en översvämning)

            known.Add(detalj);
            if (isScript) scriptRows++; else otherRows++;

            _db.AdminActivityLogs.Add(new AdminActivityLog
            {
                Tid      = now,
                AktörTyp = AktörTyper.System,
                Vem      = AktörTyper.System,
                Typ      = LoggTyper.Säkerhet,
                Rubrik   = CspLogFormat.Rubrik,
                Detalj   = detalj,
                Ip       = null,
                Enhet    = null,
            });
            added++;

            // Värdena är sanerade av parsern (bara [a-z-] och schema://värd), så loggraden kan inte injiceras.
            _logger.LogWarning("CSP-överträdelse (rapportera-läge): {Directive} mot {Origin}", v.Directive, v.Origin);
        }

        if (added > 0) await _db.SaveChangesAsync(ct);
        return added;
    }

    /// <summary>Läser högst <see cref="MaxBodyBytes"/> byte. null = för stor (eller tom) body.</summary>
    private static async Task<string?> ReadBoundedAsync(Stream body, long? contentLength, CancellationToken ct)
    {
        if (contentLength is > MaxBodyBytes) return null;

        var buffer = new byte[MaxBodyBytes + 1];
        var total = 0;
        while (total < buffer.Length)
        {
            var read = await body.ReadAsync(buffer.AsMemory(total, buffer.Length - total), ct);
            if (read == 0) break;
            total += read;
        }

        if (total == 0 || total > MaxBodyBytes) return null;
        return System.Text.Encoding.UTF8.GetString(buffer, 0, total);
    }
}
