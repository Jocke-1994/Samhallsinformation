namespace Samhallsinformation.Tests;

using Samhallsinformation.Application.Uppdateringar;
using Xunit;

public class SvenskDatumTests
{
    [Fact]
    public void FormateraDag_OktoberDatumUtanSommartid_GerSvenskMånad()
    {
        // 2026-10-15 08:00 UTC — oktober har redan gått ur sommartid (CEST
        // slutar sista söndagen i oktober), så UTC+1 gäller: 09:00 lokalt,
        // fortfarande 15:e.
        var utc = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
        Assert.Equal("15 oktober", SvenskDatum.FormateraDag(utc));
    }

    [Fact]
    public void FormateraDag_StraxEfterMidnattUtcUnderSommartid_RullarOverTillNastaDagLokalt()
    {
        // 2026-06-01 22:30 UTC, juni = sommartid (CEST, UTC+2) → 00:30 lokalt
        // den 2:a — exakt den typ av datumgräns-bugg UTC/svensk-tid-sessionen
        // (36) flaggade.
        var utc = new DateTime(2026, 6, 1, 22, 30, 0, DateTimeKind.Utc);
        Assert.Equal("2 juni", SvenskDatum.FormateraDag(utc));
    }
}
