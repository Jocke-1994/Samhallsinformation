namespace Samhallsinformation.Tests;

using Samhallsinformation.Application.Geografi;
using Xunit;

// Verifierar PlatsKatalogBygger — pluppkatalogen för det geografiska
// platsfiltret (beslut 2, 6, 13, 14 i idé-noten).
public class PlatsKatalogByggerTests
{
    [Fact]
    public void Bygg_IngaHändelser_InnehållerAllaKommunerLänOchNationelltMedNollAntal()
    {
        var katalog = PlatsKatalogBygger.Bygg([]);

        Assert.Equal(KommunLan.Alla.Count + KommunLan.AllaLan.Count + 1, katalog.Count);
        Assert.All(katalog, p => Assert.Equal(0, p.AntalHändelser));
        Assert.All(katalog, p => Assert.False(p.Aktiv));

        var botkyrka = katalog.Single(p => p.Namn == "Botkyrka");
        Assert.Equal(PlatsKatalogNivå.Kommun, botkyrka.Nivå);
        Assert.Equal("Stockholms län", botkyrka.Lan);

        var nationellt = katalog.Single(p => p.Namn == "Nationellt");
        Assert.Equal(PlatsKatalogNivå.Nationellt, nationellt.Nivå);
    }

    [Fact]
    public void Bygg_KommunTräff_RäknarBaraDenKommunen()
    {
        var katalog = PlatsKatalogBygger.Bygg([("Botkyrka", false), ("Botkyrka", false)]);

        var botkyrka = katalog.Single(p => p.Namn == "Botkyrka");
        Assert.Equal(2, botkyrka.AntalHändelser);
        Assert.True(botkyrka.Aktiv);

        var haninge = katalog.Single(p => p.Namn == "Haninge");
        Assert.False(haninge.Aktiv);
    }

    // Beslut 2: en länsvarning räknas in automatiskt för varje kommun i länet,
    // OCH får sin egen länsplupp.
    [Fact]
    public void Bygg_LänTräff_RäknasBådeFörLänetOchVarjeKommunILänet()
    {
        var katalog = PlatsKatalogBygger.Bygg([("Stockholms län", false)]);

        var länsplupp = katalog.Single(p => p.Namn == "Stockholms län");
        Assert.Equal(PlatsKatalogNivå.Lan, länsplupp.Nivå);
        Assert.Equal(1, länsplupp.AntalHändelser);

        var botkyrka = katalog.Single(p => p.Namn == "Botkyrka" && p.Nivå == PlatsKatalogNivå.Kommun);
        var haninge = katalog.Single(p => p.Namn == "Haninge" && p.Nivå == PlatsKatalogNivå.Kommun);
        Assert.Equal(1, botkyrka.AntalHändelser);
        Assert.Equal(1, haninge.AntalHändelser);

        var malmö = katalog.Single(p => p.Namn == "Malmö" && p.Nivå == PlatsKatalogNivå.Kommun);
        Assert.False(malmö.Aktiv);
    }

    // Beslut 5: Nationellt gäller bara när Geography helt saknas, inte bara
    // en olöst/okänd textsträng.
    [Fact]
    public void Bygg_IsNational_RäknasBaraSomNationelltInteSomPlats()
    {
        var katalog = PlatsKatalogBygger.Bygg([(null, true)]);

        var nationellt = katalog.Single(p => p.Namn == "Nationellt");
        Assert.Equal(1, nationellt.AntalHändelser);
        Assert.All(katalog.Where(p => p.Nivå != PlatsKatalogNivå.Nationellt), p => Assert.False(p.Aktiv));
    }

    // SMHI:s fria text (medvetet olöst, se PlatsMatchare) ska inte räknas
    // någonstans — varken som en plats eller som Nationellt.
    [Fact]
    public void Bygg_OlöstGeografi_RäknasIngenstans()
    {
        var katalog = PlatsKatalogBygger.Bygg([("Delar av Gävleborgs län", false)]);

        Assert.All(katalog, p => Assert.False(p.Aktiv));
    }

    [Fact]
    public void Bygg_BlandadeHändelser_RäknarVarjeKategoriOberoendeAvVarandra()
    {
        var katalog = PlatsKatalogBygger.Bygg(
        [
            ("Botkyrka", false),
            ("Stockholms län", false),
            (null, true),
            ("Narnia", false),
        ]);

        Assert.Equal(2, katalog.Single(p => p.Namn == "Botkyrka").AntalHändelser); // direkt + ärvt
        Assert.Equal(1, katalog.Single(p => p.Namn == "Stockholms län").AntalHändelser);
        Assert.Equal(1, katalog.Single(p => p.Namn == "Nationellt").AntalHändelser);
        Assert.Equal(1, katalog.Single(p => p.Namn == "Haninge").AntalHändelser); // bara ärvt
    }

    [Fact]
    public void Bygg_Trafikverket_RäknasPåLänetMenÄrvsInteTillKommunerna()
    {
        const int tv = PlatsMatchare.TrafikverketSourceId;
        var katalog = PlatsKatalogBygger.ByggPerKälla(
        [
            ("Skåne Väg 19", false, tv),
            ("Skåne E6", false, tv),
            ("Malmö", false, 1), // Polisen
        ]);

        Assert.Equal(2, katalog.Single(p => p.Namn == "Skåne län").AntalHändelser);
        Assert.Equal(1, katalog.Single(p => p.Namn == "Malmö").AntalHändelser); // bara Polisen
        Assert.Equal(0, katalog.Single(p => p.Namn == "Lund").AntalHändelser);
    }
}
