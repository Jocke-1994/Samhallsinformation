using System.Text.Json;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

namespace Samhallsinformation.Tests;

public class PolisenBevakningMatcherTests
{
    private static CanonicalEvent MakeEvent(string geography, string? eventType) => new()
    {
        SourceId    = 1,
        ExternalId  = Guid.NewGuid().ToString(),
        Title       = $"14 augusti 13.05, {eventType}, {geography}",
        Content     = "",
        Url         = "https://polisen.se/x",
        RawData     = "",
        Geography   = geography,
        EventType   = eventType,
        PublishedAt = DateTime.UtcNow,
    };

    private static PolisenBevakning MakeBevakning(List<string>? kategorier, List<string>? omraden) => new()
    {
        Id             = Guid.NewGuid(),
        UserId         = Guid.NewGuid(),
        KategorierJson = kategorier == null ? null : JsonSerializer.Serialize(kategorier),
        OmradenJson    = omraden    == null ? null : JsonSerializer.Serialize(omraden),
    };

    [Fact]
    public void Explain_NoBevakningar_MatchesEverything()
    {
        var ev = MakeEvent("Göteborg", "Trafikolycka");

        var (matchar, anledning, bevakningId) = PolisenBevakningMatcher.Explain(ev, []);

        Assert.True(matchar);
        Assert.Null(bevakningId);
        Assert.Contains("Ingen bevakning", anledning);
    }

    [Fact]
    public void Explain_KommunHandelseMatcharBevakningensOmrade()
    {
        var ev = MakeEvent("Kungälv", "Misshandel");
        var bevakning = MakeBevakning(null, ["Kungälv", "Stenungsund"]);

        var (matchar, _, bevakningId) = PolisenBevakningMatcher.Explain(ev, [bevakning]);

        Assert.True(matchar);
        Assert.Equal(bevakning.Id, bevakningId);
    }

    [Fact]
    public void Explain_KommunHandelseUtanforBevakningensOmrade_MatcharInte()
    {
        // Samma verkliga fall som avslöjade buggen live 2026-09-14: "Misshandel,
        // Gotland" ska INTE matcha en bevakning skopad till Kungälv/Stenungsund.
        var ev = MakeEvent("Gotland", "Misshandel");
        var bevakning = MakeBevakning(null, ["Kungälv", "Stenungsund"]);

        var (matchar, anledning, bevakningId) = PolisenBevakningMatcher.Explain(ev, [bevakning]);

        Assert.False(matchar);
        Assert.Null(bevakningId);
        Assert.Contains("Matchar ingen", anledning);
    }

    [Fact]
    public void Explain_SammanfattningIBevakningensLan_Matchar()
    {
        // Kungälv/Stenungsund ligger i Västra Götalands län — en sammanfattning
        // för det länet ska matcha, trots att bevakningen bara nämner kommuner.
        var ev = MakeEvent("Västra Götalands län", "Sammanfattning natt");
        var bevakning = MakeBevakning(null, ["Kungälv", "Stenungsund"]);

        var (matchar, _, bevakningId) = PolisenBevakningMatcher.Explain(ev, [bevakning]);

        Assert.True(matchar);
        Assert.Equal(bevakning.Id, bevakningId);
    }

    [Fact]
    public void Explain_SammanfattningIAnnatLan_MatcharInte()
    {
        // Rotorsaken till buggen som fixades 2026-09-14: innan fixen passerade
        // ALLA läns-sammanfattningar som "okänt område", oavsett bevakning.
        var ev = MakeEvent("Jönköpings län", "Sammanfattning natt");
        var bevakning = MakeBevakning(null, ["Kungälv", "Stenungsund"]);

        var (matchar, _, _) = PolisenBevakningMatcher.Explain(ev, [bevakning]);

        Assert.False(matchar);
    }

    [Fact]
    public void Explain_TypRestriktionUtanOmradesrestriktion_AndarInteOmMatchning()
    {
        var ev = MakeEvent("Jönköpings län", "Trafikolycka");
        var bevakning = MakeBevakning(["Misshandel"], null);

        var (matchar, _, _) = PolisenBevakningMatcher.Explain(ev, [bevakning]);

        Assert.False(matchar);
    }
}
