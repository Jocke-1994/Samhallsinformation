namespace Samhallsinformation.Application;

/// <summary>
/// Delad normalisering av <see cref="DateTime.Kind"/> till UTC (V3-6, E2 #4, E4 #2).
///
/// Produktionen kör PostgreSQL med <c>timestamptz</c>. Npgsql (6+) vägrar skriva — eller
/// jämföra mot en <c>timestamptz</c>-kolumn — ett <see cref="DateTime"/> med
/// <see cref="DateTimeKind.Unspecified"/> (och <see cref="DateTimeKind.Local"/>) och kastar
/// "Cannot write DateTime with Kind=Unspecified to PostgreSQL type 'timestamp with time zone'"
/// (HTTP 500). SQLite lokalt bryr sig inte, så felet syns bara i produktion.
/// En <c>[FromQuery] DateTime?</c> bunden från "2026-09-13" (eller en JSON-sträng utan "Z")
/// blir Unspecified — därför normaliseras varje DateTime på inträdet i API:t, och
/// <see cref="Data.UtcDateTimeConverter"/> är sista skyddsnätet vid skrivning.
///
/// Våra egna tidsstämplar är alltid UTC, så en Unspecified tolkas som redan-UTC (relabeling,
/// ingen tidsförskjutning). Local konverteras på riktigt (den bär en verklig offset).
/// Ett värde som redan är Utc returneras oförändrat.
/// </summary>
public static class UtcDateTime
{
    public static DateTime Ensure(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    public static DateTime? Ensure(DateTime? value) =>
        value.HasValue ? Ensure(value.Value) : null;
}
