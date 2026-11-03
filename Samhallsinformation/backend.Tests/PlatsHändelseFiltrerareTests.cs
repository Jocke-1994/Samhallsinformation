namespace Samhallsinformation.Tests;

using Samhallsinformation.Application.Geografi;
using Xunit;

// Verifierar PlatsHändelseFiltrerare — den sektionerade resultatvyns
// per-plats-filtrering (beslut 2, 3, 4, 5 i idé-noten).
public class PlatsHändelseFiltrerareTests
{
    [Fact]
    public void GällerPlats_DirektKommunträff_Gäller()
    {
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", "Botkyrka", false));
    }

    [Fact]
    public void GällerPlats_AnnanKommun_GällerInte()
    {
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", "Haninge", false));
    }

    // Beslut 2: en länsvarning räknas in för varje kommun i länet.
    [Fact]
    public void GällerPlats_LänsvarningFörKommunensLän_ÄrvsInTillKommunen()
    {
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", "Stockholms län", false));
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Haninge", "Stockholms län", false));
    }

    [Fact]
    public void GällerPlats_LänsvarningFörAnnatLän_GällerInteKommunen()
    {
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", "Skåne län", false));
    }

    // En kommunhändelse gäller aldrig hela länet — bara den omvända
    // riktningen (länsträff → kommun) är beslutad att ärvas.
    [Fact]
    public void GällerPlats_KommunhändelseGällerInteHelaLänet()
    {
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Stockholms län", "Botkyrka", false));
    }

    [Fact]
    public void GällerPlats_DirektLänsträffPåValtLän_Gäller()
    {
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Stockholms län", "Stockholms län", false));
    }

    // Beslut 5: Nationellt gäller bara IsNational, inte en olöst textsträng.
    [Fact]
    public void GällerPlats_Nationellt_MatcharBaraIsNationalFlaggan()
    {
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Nationellt", null, true));
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Nationellt", "Botkyrka", false));
    }

    [Fact]
    public void GällerPlats_IsNational_GällerIngenPlats()
    {
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", null, true));
    }

    // Beslut 2026-11-03: Trafikverket gäller bara länets egen plupp.
    [Fact]
    public void GällerPlats_Trafikverket_GällerLänetMenInteKommunerna()
    {
        const int tv = PlatsMatchare.TrafikverketSourceId;
        Assert.True(PlatsHändelseFiltrerare.GällerPlats("Skåne län", "Skåne Väg 19", false, tv));
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Malmö", "Skåne Väg 19", false, tv));
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Uppsala", "Uppsala E18", false, tv));
    }

    [Fact]
    public void GällerPlats_OlöstGeografi_GällerIngenPlats()
    {
        Assert.False(PlatsHändelseFiltrerare.GällerPlats("Botkyrka", "Delar av Gävleborgs län", false));
    }
}
