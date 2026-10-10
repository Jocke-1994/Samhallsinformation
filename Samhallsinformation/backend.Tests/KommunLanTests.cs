namespace Samhallsinformation.Tests;

using Samhallsinformation.Application.Geografi;
using Xunit;

// Sveriges kommun→län-referenstabell (förberedelse för det geografiska
// platsfiltret, se docs/vault/Ideer/Geografiskt-platsfilter-besokare.md).
// En felaktig rad i 290 hårdkodade är lätt att missa vid en vanlig
// kodgranskning — strukturella kontroller (antal, inga dubbletter, inga
// tomma fält) plus stickprov mot kända kommun/län-par skyddar mot det.
public class KommunLanTests
{
    [Fact]
    public void Alla_InnehållerExakt290Kommuner()
    {
        Assert.Equal(290, KommunLan.Alla.Count);
    }

    [Fact]
    public void Alla_InnehållerExakt21Län()
    {
        Assert.Equal(21, KommunLan.AllaLan.Count);
    }

    [Fact]
    public void Alla_IngaDubblettKommuner()
    {
        var unika = KommunLan.Alla.Select(p => p.Kommun).Distinct(StringComparer.OrdinalIgnoreCase).Count();
        Assert.Equal(290, unika);
    }

    [Fact]
    public void Alla_IngaDubblettKommunkoder()
    {
        var unika = KommunLan.Alla.Select(p => p.KommunKod).Distinct().Count();
        Assert.Equal(290, unika);
    }

    [Fact]
    public void Alla_IngetFältÄrTomt()
    {
        Assert.All(KommunLan.Alla, p =>
        {
            Assert.False(string.IsNullOrWhiteSpace(p.Kommun));
            Assert.False(string.IsNullOrWhiteSpace(p.Lan));
            Assert.False(string.IsNullOrWhiteSpace(p.KommunKod));
            Assert.Matches("^[0-9]{4}$", p.KommunKod);
            Assert.EndsWith(" län", p.Lan);
        });
    }

    [Theory]
    [InlineData("Botkyrka", "Stockholms län")]
    [InlineData("Haninge", "Stockholms län")]
    [InlineData("Stockholm", "Stockholms län")]
    [InlineData("Göteborg", "Västra Götalands län")]
    [InlineData("Malmö", "Skåne län")]
    [InlineData("Kiruna", "Norrbottens län")]
    [InlineData("Kungälv", "Västra Götalands län")]
    [InlineData("Stenungsund", "Västra Götalands län")]
    [InlineData("Halmstad", "Hallands län")]
    [InlineData("Kalmar", "Kalmar län")]
    [InlineData("Örnsköldsvik", "Västernorrlands län")]
    [InlineData("Växjö", "Kronobergs län")]
    [InlineData("Gotland", "Gotlands län")]
    public void LanForKommun_KändaKommuner_GerRättLän(string kommun, string förväntatLän)
    {
        Assert.Equal(förväntatLän, KommunLan.LanForKommun[kommun]);
    }

    [Fact]
    public void LanForKommun_ÄrSkiftlägesokänslig()
    {
        Assert.Equal("Stockholms län", KommunLan.LanForKommun["botkyrka"]);
        Assert.Equal("Stockholms län", KommunLan.LanForKommun["BOTKYRKA"]);
    }

    [Fact]
    public void AllaLan_ÄrSorteradOchInnehållerStockholmsLan()
    {
        Assert.Contains("Stockholms län", KommunLan.AllaLan);
        var sorterad = KommunLan.AllaLan.OrderBy(l => l, StringComparer.Ordinal).ToList();
        Assert.Equal(sorterad, KommunLan.AllaLan);
    }

    [Fact]
    public void AllaKommuner_ÄrSorteradOchInnehåller290()
    {
        Assert.Equal(290, KommunLan.AllaKommuner.Count);
        var sorterad = KommunLan.AllaKommuner.OrderBy(k => k, StringComparer.Ordinal).ToList();
        Assert.Equal(sorterad, KommunLan.AllaKommuner);
    }
}
