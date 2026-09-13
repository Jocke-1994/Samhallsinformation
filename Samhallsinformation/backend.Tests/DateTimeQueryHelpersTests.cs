namespace Samhallsinformation.Tests;

using Samhallsinformation.Application;
using Xunit;

public class DateTimeQueryHelpersTests
{
    [Fact]
    public void EnsureUtcKind_UnspecifiedKind_BecomesUtc()
    {
        var dt = new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Unspecified);

        var result = DateTimeQueryHelpers.EnsureUtcKind(dt);

        Assert.Equal(DateTimeKind.Utc, result.Kind);
        Assert.Equal(dt.Ticks, result.Ticks); // relabeling, ingen tidsförskjutning
    }

    [Fact]
    public void EnsureUtcKind_LocalKind_BecomesUtc()
    {
        var dt = new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Local);

        var result = DateTimeQueryHelpers.EnsureUtcKind(dt);

        Assert.Equal(DateTimeKind.Utc, result.Kind);
    }

    [Fact]
    public void EnsureUtcKind_AlreadyUtc_Unchanged()
    {
        var dt = new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Utc);

        var result = DateTimeQueryHelpers.EnsureUtcKind(dt);

        Assert.Equal(dt, result);
    }
}
