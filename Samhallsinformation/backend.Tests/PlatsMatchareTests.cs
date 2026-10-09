namespace Samhallsinformation.Tests;

using Samhallsinformation.Application.Geografi;
using Xunit;

// Verifierar PlatsMatchare mot både konstruerade fall och riktiga Geography-
// strängar hittade i den lokala databasen 2026-10-09 (se PlatsMatchare.cs
// klassdokumentation för den fulla genomgången per källa).
public class PlatsMatchareTests
{
    [Theory]
    [InlineData("Botkyrka", PlatsNivå.Kommun, "Botkyrka", "Stockholms län")]
    [InlineData("botkyrka", PlatsNivå.Kommun, "Botkyrka", "Stockholms län")] // skiftlägesokänslig
    [InlineData("Malmö", PlatsNivå.Kommun, "Malmö", "Skåne län")]
    [InlineData("Örebro", PlatsNivå.Kommun, "Örebro", "Örebro län")]
    [InlineData("Hallands län", PlatsNivå.Lan, "Hallands län", "Hallands län")]
    [InlineData("västerbottens län", PlatsNivå.Lan, "Västerbottens län", "Västerbottens län")]
    public void Matcha_KändaRiktigaPolisenVärden_GerRättTräff(string geografi, PlatsNivå förväntadNivå, string förväntatNamn, string förväntatLän)
    {
        var träff = PlatsMatchare.Matcha(geografi);
        Assert.NotNull(träff);
        Assert.Equal(förväntadNivå, träff!.Nivå);
        Assert.Equal(förväntatNamn, träff.Namn);
        Assert.Equal(förväntatLän, träff.Lan);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Matcha_IngenGeografi_ReturnerarNull(string? geografi)
    {
        Assert.Null(PlatsMatchare.Matcha(geografi));
    }

    // Riktiga, hittade SMHI-strängar (2026-10-09) — inget av det ska matcha
    // något, och inget ska kasta ett undantag.
    [Theory]
    [InlineData("Skagerrak")]
    [InlineData("Kattegatt")]
    [InlineData("Delar av Gävleborgs län")]
    [InlineData("Norra Värmland, Dalarna väster om Siljan och södra Jämtlands län.")]
    [InlineData("Bohuslän, Dalsland och sydvästra Värmland")]
    public void Matcha_SmhiFritext_ReturnerarNullAldrigKrasch(string geografi)
    {
        Assert.Null(PlatsMatchare.Matcha(geografi));
    }

    // Riktig Trafikverket-form: länsnamn + vägsträcka. Matchar inte (county-only
    // hade matchat, se testet ovan för "Hallands län") — ett känt, accepterat
    // v1-gap, inte en bugg.
    [Fact]
    public void Matcha_TrafikverketLänPlusVägnummer_ReturnerarNull()
    {
        Assert.Null(PlatsMatchare.Matcha("Stockholms län E4"));
    }

    [Fact]
    public void Matcha_OkäntOrtnamn_ReturnerarNull()
    {
        Assert.Null(PlatsMatchare.Matcha("Narnia"));
    }

    [Fact]
    public void KommunerILan_StockholmsLän_InnehållerBotkyrkaOchHaninge()
    {
        var kommuner = PlatsMatchare.KommunerILan("Stockholms län");
        Assert.Contains("Botkyrka", kommuner);
        Assert.Contains("Haninge", kommuner);
        Assert.DoesNotContain("Malmö", kommuner);
    }

    [Fact]
    public void KommunerILan_OkäntLän_ReturnerarTomLista()
    {
        Assert.Empty(PlatsMatchare.KommunerILan("Narnia län"));
    }
}
