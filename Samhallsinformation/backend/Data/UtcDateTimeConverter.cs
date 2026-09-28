namespace Samhallsinformation.Data;

using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Samhallsinformation.Application;

// LÄSVÄGEN: SQLite (och potentiellt andra providers) tappar DateTime.Kind vid läsning —
// allt i den här kodbasen sparas som UTC (DateTime.UtcNow överallt), men kommer
// tillbaka som Kind=Unspecified. System.Text.Json serialiserar då datumet utan
// "Z"-suffix, och webbläsaren tolkar strängen som redan lokal tid istället för
// att konvertera från UTC — fel klockslag visas (upptäckt i Ärendehanteringen,
// men gäller alla DateTime-fält i hela appen).
//
// SKRIVVÄGEN (V3-6): Npgsql vägrar skriva Kind=Unspecified/Local till timestamptz
// (500 i produktion, grönt i SQLite). Skrivning normaliseras därför också, via
// UtcDateTime.Ensure: Utc oförändrad, Local -> UTC, Unspecified -> tolkas som UTC
// (samma antagande som läsvägen). Konvertern registreras som konvention för ALLA
// DateTime och DateTime? i AppDbContext.ConfigureConventions, och EF tillämpar den
// även på frågeparametrar som jämförs mot en sådan kolumn.
public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter() : base(
        v => UtcDateTime.Ensure(v),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }
}

public class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
{
    public NullableUtcDateTimeConverter() : base(
        v => v.HasValue ? UtcDateTime.Ensure(v.Value) : v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
    {
    }
}
