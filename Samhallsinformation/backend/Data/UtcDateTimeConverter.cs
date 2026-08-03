namespace Samhallsinformation.Data;

using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

// SQLite (och potentiellt andra providers) tappar DateTime.Kind vid läsning —
// allt i den här kodbasen sparas som UTC (DateTime.UtcNow överallt), men kommer
// tillbaka som Kind=Unspecified. System.Text.Json serialiserar då datumet utan
// "Z"-suffix, och webbläsaren tolkar strängen som redan lokal tid istället för
// att konvertera från UTC — fel klockslag visas (upptäckt i Ärendehanteringen,
// men gäller alla DateTime-fält i hela appen).
public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter() : base(
        v => v,
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }
}

public class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
{
    public NullableUtcDateTimeConverter() : base(
        v => v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
    {
    }
}
