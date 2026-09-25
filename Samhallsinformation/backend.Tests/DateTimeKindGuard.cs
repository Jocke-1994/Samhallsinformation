namespace Samhallsinformation.Tests;

using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

/// <summary>
/// Återanvändbar testvakt (V3-6, E2 #4 / E4 #2) som härmar Npgsqls regel för <c>timestamptz</c>:
/// ett <see cref="DateTime"/> med <see cref="DateTimeKind.Unspecified"/> eller
/// <see cref="DateTimeKind.Local"/> får inte skickas som kommandoparameter. Produktionen
/// (PostgreSQL) svarar annars med 500 — SQLite lokalt bryr sig inte och är grönt.
///
/// Vakten är en <see cref="DbCommandInterceptor"/> som inspekterar ALLA parametrar på varje
/// kommando (INSERT/UPDATE såväl som frågor med WHERE-parametrar). Kopplas på via
/// <c>TestDb.Create(guard)</c>; skriv scenariot genom en riktig kontext och läs sedan
/// <see cref="Violations"/> eller anropa <see cref="AssertNoViolations"/>.
///
/// Notera: detta är en PROXY — den kontrollerar värdet som EF skulle skicka till providern
/// (efter value converters), inte själva Npgsql-beteendet.
/// </summary>
public sealed class DateTimeKindGuard : DbCommandInterceptor
{
    private readonly List<string> _violations = [];

    /// <summary>Om true (standard) kastas ett undantag direkt när en felaktig parameter ses,
    /// så testet faller vid det exakta anropet. Sätt false för att bara samla in.</summary>
    public bool ThrowOnViolation { get; init; } = true;

    /// <summary>Antal DateTime-/DateTimeOffset-parametrar som kontrollerats. Ett test bör kräva
    /// &gt; 0 så att vakten inte är tyst verkningslös.</summary>
    public int InspectedDateTimeParameters { get; private set; }

    public IReadOnlyList<string> Violations => _violations;

    public void AssertNoViolations()
    {
        if (_violations.Count > 0)
            throw new InvalidOperationException(
                "DateTime-parametrar med Kind != Utc (Npgsql/timestamptz hade gett 500):\n" +
                string.Join("\n", _violations));
    }

    private void Inspect(DbCommand command)
    {
        foreach (DbParameter p in command.Parameters)
        {
            switch (p.Value)
            {
                case DateTime dt:
                    InspectedDateTimeParameters++;
                    if (dt.Kind != DateTimeKind.Utc)
                        Report(command, p, $"DateTime Kind={dt.Kind} ({dt:O})");
                    break;
                case DateTimeOffset dto:
                    InspectedDateTimeParameters++;
                    if (dto.Offset != TimeSpan.Zero)
                        Report(command, p, $"DateTimeOffset offset={dto.Offset} ({dto:O})");
                    break;
            }
        }
    }

    private void Report(DbCommand command, DbParameter p, string what)
    {
        var msg = $"Parameter {p.ParameterName}: {what} i: {command.CommandText.ReplaceLineEndings(" ")}";
        _violations.Add(msg);
        if (ThrowOnViolation) throw new InvalidOperationException(msg);
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Inspect(command);
        return result;
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        Inspect(command);
        return new ValueTask<InterceptionResult<DbDataReader>>(result);
    }

    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Inspect(command);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Inspect(command);
        return new ValueTask<InterceptionResult<int>>(result);
    }

    public override InterceptionResult<object> ScalarExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    {
        Inspect(command);
        return result;
    }

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result,
        CancellationToken cancellationToken = default)
    {
        Inspect(command);
        return new ValueTask<InterceptionResult<object>>(result);
    }
}
