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

    // Riktiga Trafikverket-strängar från produktion 2026-11-03. Formatet är
    // länets grundnamn utan "län", ofta följt av ett vägnummer.
    [Theory]
    [InlineData("Skåne", "Skåne län")]
    [InlineData("Skåne E6", "Skåne län")]
    [InlineData("Västra Götaland Väg 1040", "Västra Götalands län")]
    [InlineData("Uppsala E18", "Uppsala län")]
    [InlineData("Blekinge", "Blekinge län")]
    [InlineData("Västerbotten E4", "Västerbottens län")]
    [InlineData("Halland E6", "Hallands län")]
    [InlineData("Dalarna Väg 70", "Dalarnas län")]
    public void Matcha_TrafikverketFormat_GerLänsträffSomInteÄrvs(string geografi, string förväntatLän)
    {
        var träff = PlatsMatchare.Matcha(geografi, PlatsMatchare.TrafikverketSourceId);
        Assert.NotNull(träff);
        Assert.Equal(PlatsNivå.Lan, träff!.Nivå);
        Assert.Equal(förväntatLän, träff.Namn);
        Assert.False(träff.ÄrvsTillKommuner);
    }

    // "Uppsala"/"Kalmar"/"Stockholm" är både kommun och län. Från Trafikverket
    // betyder det alltid länet, från Polisen alltid kommunen.
    [Fact]
    public void Matcha_TvetydigtNamn_TolkasEfterKälla()
    {
        Assert.Equal(PlatsNivå.Lan, PlatsMatchare.Matcha("Uppsala", PlatsMatchare.TrafikverketSourceId)!.Nivå);
        Assert.Equal(PlatsNivå.Kommun, PlatsMatchare.Matcha("Uppsala", 1)!.Nivå);
    }

    [Theory]
    [InlineData("E4")]
    [InlineData("Väg 273")]
    [InlineData("Västra")] // början av ett länsnamn räcker inte
    [InlineData(null)]
    public void Matcha_TrafikverketUtanLän_ReturnerarNull(string? geografi)
    {
        Assert.Null(PlatsMatchare.Matcha(geografi, PlatsMatchare.TrafikverketSourceId));
    }

    // Den vanliga regeln är oförändrad: Trafikverkets format matchar inte
    // där, så en annan källa kan aldrig råka gå genom Trafikverket-regeln.
    [Fact]
    public void Matcha_TrafikverketFormatUtanKälla_ReturnerarNull()
    {
        Assert.Null(PlatsMatchare.Matcha("Skåne E6"));
    }

    [Fact]
    public void TrafikverketLän_VarjeMålFinnsIKommunLanOchAllaLänTäcks()
    {
        Assert.All(PlatsMatchare.TrafikverketLänMål, l => Assert.Contains(l, KommunLan.AllaLan));
        Assert.Equal(KommunLan.AllaLan.Count, PlatsMatchare.TrafikverketLänMål.Distinct().Count());
    }

    [Fact]
    public void TrafikverketSourceId_MatcharIngestornsKälla()
    {
        var ingestor = new Samhallsinformation.Ingestors.TrafikverketApiIngestor(
            new HttpClient(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<Samhallsinformation.Ingestors.TrafikverketApiIngestor>.Instance);
        Assert.Equal(PlatsMatchare.TrafikverketSourceId, ingestor.Source.Id);
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
