namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application;
using Samhallsinformation.Data;
using Xunit;

/// <summary>
/// Ren logik för <see cref="UtcDateTime"/> (V3-6) och konverterns skrivväg (E2 #4).
/// Ersätter DateTimeQueryHelpersTests (hjälparen flyttades till UtcDateTime).
/// </summary>
public class UtcDateTimeTests
{
    [Fact]
    public void Ensure_UnspecifiedKind_BecomesUtc_WithoutShiftingTime()
    {
        var dt = new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Unspecified);

        var result = UtcDateTime.Ensure(dt);

        Assert.Equal(DateTimeKind.Utc, result.Kind);
        Assert.Equal(dt.Ticks, result.Ticks); // relabeling, ingen tidsförskjutning
    }

    [Fact]
    public void Ensure_LocalKind_IsConvertedToUtc()
    {
        var dt = new DateTime(2026, 9, 13, 12, 0, 0, DateTimeKind.Local);

        var result = UtcDateTime.Ensure(dt);

        Assert.Equal(DateTimeKind.Utc, result.Kind);
        Assert.Equal(dt.ToUniversalTime(), result);
    }

    [Fact]
    public void Ensure_AlreadyUtc_Unchanged()
    {
        var dt = new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Utc);

        var result = UtcDateTime.Ensure(dt);

        Assert.Equal(dt, result);
        Assert.Equal(DateTimeKind.Utc, result.Kind);
    }

    [Fact]
    public void Ensure_Nullable_NullStaysNull_ValueIsNormalized()
    {
        Assert.Null(UtcDateTime.Ensure((DateTime?)null));

        var result = UtcDateTime.Ensure((DateTime?)new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Unspecified));
        Assert.Equal(DateTimeKind.Utc, result!.Value.Kind);
    }

    // ---- Konverterns skrivväg (ConvertToProvider) ----

    [Fact]
    public void Converter_Write_Unspecified_IsTreatedAsUtc()
    {
        var conv = new UtcDateTimeConverter();
        var dt = new DateTime(2026, 9, 1, 8, 30, 0, DateTimeKind.Unspecified);

        var written = (DateTime)conv.ConvertToProvider(dt)!;

        Assert.Equal(DateTimeKind.Utc, written.Kind);
        Assert.Equal(dt.Ticks, written.Ticks);
    }

    [Fact]
    public void Converter_Write_Local_IsConvertedToUtc()
    {
        var conv = new UtcDateTimeConverter();
        var dt = new DateTime(2026, 9, 1, 8, 30, 0, DateTimeKind.Local);

        var written = (DateTime)conv.ConvertToProvider(dt)!;

        Assert.Equal(DateTimeKind.Utc, written.Kind);
        Assert.Equal(dt.ToUniversalTime(), written);
    }

    [Fact]
    public void Converter_Write_Utc_IsUnchanged()
    {
        var conv = new UtcDateTimeConverter();
        var dt = new DateTime(2026, 9, 1, 8, 30, 0, DateTimeKind.Utc);

        var written = (DateTime)conv.ConvertToProvider(dt)!;

        Assert.Equal(dt, written);
        Assert.Equal(DateTimeKind.Utc, written.Kind);
    }

    [Fact]
    public void NullableConverter_Write_NormalizesValue_AndKeepsNull()
    {
        var conv = new NullableUtcDateTimeConverter();

        Assert.Null(conv.ConvertToProvider(null));
        var unspec = (DateTime)conv.ConvertToProvider(new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Unspecified))!;
        var local  = (DateTime)conv.ConvertToProvider(new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Local))!;

        Assert.Equal(DateTimeKind.Utc, unspec.Kind);
        Assert.Equal(DateTimeKind.Utc, local.Kind);
    }

    [Fact]
    public void Converter_Read_StillMarksValuesAsUtc()
    {
        var conv = new UtcDateTimeConverter();
        var fromDb = new DateTime(2026, 9, 1, 8, 30, 0, DateTimeKind.Unspecified);

        var read = (DateTime)conv.ConvertFromProvider(fromDb)!;

        Assert.Equal(DateTimeKind.Utc, read.Kind);
    }

    [Fact]
    public void EveryDateTimeProperty_InTheModel_UsesAUtcNormalizingConverter()
    {
        using var db = TestDb.Create();

        var missing = new List<string>();
        var checkedCount = 0;
        foreach (var entity in db.Model.GetEntityTypes())
        foreach (var prop in entity.GetProperties())
        {
            var clr = Nullable.GetUnderlyingType(prop.ClrType) ?? prop.ClrType;
            if (clr != typeof(DateTime)) continue;
            checkedCount++;

            var converter = prop.GetValueConverter() ?? prop.GetTypeMapping().Converter;
            if (converter is not (UtcDateTimeConverter or NullableUtcDateTimeConverter))
                missing.Add($"{entity.DisplayName()}.{prop.Name}");
        }

        Assert.True(checkedCount > 20, "Förväntade många DateTime-egenskaper i modellen.");
        Assert.Empty(missing);
    }
}
