namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Application.Faq;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-19 (E2#1): FAQ-seeden får aldrig skriva över adminens ändringar eller återskapa raderade/omdöpta
/// frågor. Riktig relationsdatabas (SQLite via <see cref="TestDb"/>). Före fixen körde Program.cs alla
/// FAQ-block vid VARJE start och matchade på frågetexten.
/// </summary>
public class FaqSeederTests
{
    private const string FragaRadera = "Hur tar jag bort mitt konto?";
    private const string FragaExport = "Hur laddar jag ner min data?";
    private const string FragaSkrappost = "Varför hittar jag inte mejlet ni sagt att ni skickat?";

    // 9 ursprungliga + 7 (session 43) + 2 (session 49).
    private const int AntalFragor = 18;

    private sealed class ListLogger : ILogger
    {
        public List<(LogLevel Level, string Message, Exception? Ex)> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }

    private static Task Seed(AppDbContext db, ILogger? logger = null) =>
        FaqSeeder.SeedAsync(db, logger ?? new ListLogger());

    private record Rad(Guid Id, string Kategori, bool Publicerad, string Fraga, string Svar, string? FlagKey, DateTime UpdatedAt);

    // Läser via en andra kontext med tom change tracker — det som FAKTISKT ligger i databasen.
    private static async Task<List<Rad>> Snapshot(AppDbContext db)
    {
        using var fresh = TestDb.CreateSecondContext(db);
        return (await fresh.FaqItems.AsNoTracking().OrderBy(f => f.Fraga).ToListAsync())
            .Select(f => new Rad(f.Id, f.Kategori, f.Publicerad, f.Fraga, f.Svar, f.FlagKey, f.UpdatedAt))
            .ToList();
    }

    private static async Task<HashSet<string>> Markorer(AppDbContext db)
    {
        using var fresh = TestDb.CreateSecondContext(db);
        return (await fresh.AppliedSeeds.AsNoTracking().Select(a => a.Key).ToListAsync()).ToHashSet();
    }

    [Fact]
    public async Task SeedAsync_TomDatabas_SeedarAllaFragorOchMarkerarDem()
    {
        using var db = TestDb.Create();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal(AntalFragor, rader.Count);
        Assert.Equal(AntalFragor, rader.Select(r => r.Fraga).Distinct().Count());

        var markorer = await Markorer(db);
        Assert.Contains(FaqSeeder.BaslinjeMarkor, markorer);
        foreach (var nyckel in FaqSeeder.AllaNycklar)
            Assert.Contains(FaqSeeder.MarkorPrefix + nyckel, markorer);
    }

    [Fact]
    public async Task SeedAsync_TomDatabas_GdprFragornaFarSinaEngangsuppdateringar()
    {
        using var db = TestDb.Create();

        await Seed(db);

        var rader = await Snapshot(db);
        var radera = rader.Single(r => r.Fraga == FragaRadera);
        Assert.True(radera.Publicerad);
        Assert.Equal("konto_datahantering", radera.FlagKey);
        Assert.Contains("24 timmar", radera.Svar);
        var export = rader.Single(r => r.Fraga == FragaExport);
        Assert.True(export.Publicerad);
        Assert.Equal("konto_datahantering", export.FlagKey);
    }

    [Fact]
    public async Task SeedAsync_TomDatabas_BehallerFlaggkopplingarOchPubliceringFranOriginalet()
    {
        using var db = TestDb.Create();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal("konto_losenord", rader.Single(r => r.Fraga == "Hur byter jag lösenord?").FlagKey);
        Assert.Equal("kallor_polisen_filter", rader.Single(r => r.Fraga == "Vad är en Polisen-bevakning?").FlagKey);
        Assert.Null(rader.Single(r => r.Fraga == FragaSkrappost).FlagKey);
        // Push-frågorna var avpublicerade i den ursprungliga seeden.
        Assert.False(rader.Single(r => r.Fraga == "Hur aktiverar jag push-notiser?").Publicerad);
        Assert.True(rader.Single(r => r.Fraga == "Hur rapporterar jag ett fel?").Publicerad);
    }

    [Fact]
    public async Task SeedAsync_AndraKorningen_AndrarInget()
    {
        using var db = TestDb.Create();
        await Seed(db);
        var fore = await Snapshot(db);
        var markorerFore = await Markorer(db);

        await Seed(db);
        await Seed(db);

        Assert.Equal(fore, await Snapshot(db));
        Assert.Equal(markorerFore, await Markorer(db));
    }

    [Fact]
    public async Task SeedAsync_AdminAndrarSvaret_SkrivsInteOver()
    {
        using var db = TestDb.Create();
        await Seed(db);
        var radera = await db.FaqItems.SingleAsync(f => f.Fraga == FragaRadera);
        radera.Svar = "Adminens egen text.";
        await db.SaveChangesAsync();

        await Seed(db);

        Assert.Equal("Adminens egen text.", (await Snapshot(db)).Single(r => r.Fraga == FragaRadera).Svar);
    }

    [Fact]
    public async Task SeedAsync_AdminAvpublicerarGdprFragorna_BliverAvpublicerade()
    {
        using var db = TestDb.Create();
        await Seed(db);
        foreach (var f in await db.FaqItems.Where(f => f.Fraga == FragaRadera || f.Fraga == FragaExport).ToListAsync())
        {
            f.Publicerad = false;
            f.FlagKey = null;
        }
        await db.SaveChangesAsync();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.All(rader.Where(r => r.Fraga == FragaRadera || r.Fraga == FragaExport), r =>
        {
            Assert.False(r.Publicerad);
            Assert.Null(r.FlagKey);
        });
    }

    [Fact]
    public async Task SeedAsync_AdminRaderarSeedadFraga_ÅterskapasInte()
    {
        using var db = TestDb.Create();
        await Seed(db);
        db.FaqItems.RemoveRange(db.FaqItems.Where(f => f.Fraga == FragaSkrappost || f.Fraga == FragaRadera));
        await db.SaveChangesAsync();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal(AntalFragor - 2, rader.Count);
        Assert.DoesNotContain(rader, r => r.Fraga == FragaSkrappost);
        Assert.DoesNotContain(rader, r => r.Fraga == FragaRadera);
    }

    [Fact]
    public async Task SeedAsync_AdminRaderarAllaFragor_SeedasInteOmIgen()
    {
        using var db = TestDb.Create();
        await Seed(db);
        db.FaqItems.RemoveRange(db.FaqItems);
        await db.SaveChangesAsync();

        await Seed(db);

        Assert.Empty(await Snapshot(db));
    }

    [Fact]
    public async Task SeedAsync_AdminAndrarFrageTexten_GerIngenDubblett()
    {
        using var db = TestDb.Create();
        await Seed(db);
        var rad = await db.FaqItems.SingleAsync(f => f.Fraga == FragaSkrappost);
        rad.Fraga = "Var är mejlet?";
        var radera = await db.FaqItems.SingleAsync(f => f.Fraga == FragaRadera);
        radera.Fraga = "Hur raderar jag kontot?";
        await db.SaveChangesAsync();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal(AntalFragor, rader.Count);
        Assert.DoesNotContain(rader, r => r.Fraga == FragaSkrappost);
        Assert.DoesNotContain(rader, r => r.Fraga == FragaRadera);
        Assert.Contains(rader, r => r.Fraga == "Var är mejlet?");
        Assert.Contains(rader, r => r.Fraga == "Hur raderar jag kontot?");
    }

    [Fact]
    public async Task SeedAsync_BefintligDatabasUtanMarkorer_SatterBaslinjeUtanAttRoraNagraRader()
    {
        // Produktionsfallet: den gamla koden har redan seedat, admin har ändrat sedan dess, inga markörer finns.
        using var db = TestDb.Create();
        db.FaqItems.AddRange(
            new FaqItem { Kategori = "Konto", Publicerad = false, FlagKey = null, Fraga = FragaRadera, Svar = "Adminens omskrivna svar, avpublicerad." },
            new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_datahantering", Fraga = FragaExport, Svar = "Adminens exportsvar." },
            new FaqItem { Kategori = "Övrigt", Publicerad = true, Fraga = "Helt egen fråga från admin?", Svar = "Ja." });
        await db.SaveChangesAsync();
        var fore = await Snapshot(db);

        await Seed(db);

        Assert.Equal(fore, await Snapshot(db));   // ingen rad ändrad, ingen tillagd (inte heller de 15 andra frågorna)
        var markorer = await Markorer(db);
        Assert.Contains(FaqSeeder.BaslinjeMarkor, markorer);
        foreach (var nyckel in FaqSeeder.AllaNycklar)
            Assert.Contains(FaqSeeder.MarkorPrefix + nyckel, markorer);
    }

    [Fact]
    public async Task SeedAsync_ProduktionsfalletKortTvaGanger_ForblirOrort()
    {
        using var db = TestDb.Create();
        db.FaqItems.Add(new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = FragaRadera, Svar = "Admin." });
        await db.SaveChangesAsync();
        await Seed(db);
        var efterForsta = await Snapshot(db);

        // Admin ändrar efter första deployen av nya koden.
        var rad = await db.FaqItems.SingleAsync();
        rad.Svar = "Admin igen.";
        await db.SaveChangesAsync();
        await Seed(db);

        var efterAndra = await Snapshot(db);
        Assert.Single(efterAndra);
        Assert.Equal("Admin igen.", efterAndra[0].Svar);
        Assert.False(efterAndra[0].Publicerad);
        Assert.Single(efterForsta);
    }

    [Fact]
    public async Task SeedAsync_EngangsuppdateringenKorsBaraEnGang()
    {
        // En miljö där frågorna redan seedats (baslinje + fråge-markörer finns) men GDPR-uppdateringarna
        // inte körts — uppdateringen ska köras exakt en gång, sedan aldrig mer.
        using var db = TestDb.Create();
        db.FaqItems.Add(new FaqItem { Kategori = "Konto", Publicerad = false, FlagKey = null, Fraga = FragaRadera, Svar = "Gammalt svar." });
        db.AppliedSeeds.Add(new AppliedSeed { Key = FaqSeeder.BaslinjeMarkor });
        foreach (var nyckel in FaqSeeder.AllaNycklar.Where(n => !n.StartsWith("uppdatera_")))
            db.AppliedSeeds.Add(new AppliedSeed { Key = FaqSeeder.MarkorPrefix + nyckel });
        await db.SaveChangesAsync();

        await Seed(db);

        var efterUppdatering = (await Snapshot(db)).Single();
        Assert.True(efterUppdatering.Publicerad);
        Assert.Equal("konto_datahantering", efterUppdatering.FlagKey);
        Assert.Contains("24 timmar", efterUppdatering.Svar);

        // Admin ändrar tillbaka — nästa start får inte göra om uppdateringen.
        var rad = await db.FaqItems.SingleAsync();
        rad.Publicerad = false;
        rad.FlagKey = null;
        rad.Svar = "Admin igen.";
        await db.SaveChangesAsync();
        await Seed(db);

        var efterAndra = (await Snapshot(db)).Single();
        Assert.False(efterAndra.Publicerad);
        Assert.Null(efterAndra.FlagKey);
        Assert.Equal("Admin igen.", efterAndra.Svar);
    }

    [Fact]
    public async Task SeedAsync_EngangsuppdateringenSaknarMalrad_MarkerasUtanFel()
    {
        // Admin har raderat/döpt om GDPR-frågan innan uppdateringen hunnit köras — inget att uppdatera, ingen krasch.
        using var db = TestDb.Create();
        db.FaqItems.Add(new FaqItem { Kategori = "Konto", Fraga = "Något helt annat?", Svar = "x" });
        db.AppliedSeeds.Add(new AppliedSeed { Key = FaqSeeder.BaslinjeMarkor });
        foreach (var nyckel in FaqSeeder.AllaNycklar.Where(n => !n.StartsWith("uppdatera_")))
            db.AppliedSeeds.Add(new AppliedSeed { Key = FaqSeeder.MarkorPrefix + nyckel });
        await db.SaveChangesAsync();
        var logger = new ListLogger();

        await Seed(db, logger);

        Assert.Single(await Snapshot(db));
        Assert.Contains(FaqSeeder.MarkorPrefix + "uppdatera_radera_konto", await Markorer(db));
        Assert.DoesNotContain(logger.Entries, e => e.Level >= LogLevel.Error);
    }

    [Fact]
    public async Task SeedAsync_NyFragaSaknarMarkor_SeedasEnGangMenInteDeAndra()
    {
        // Framtida release lägger till en ny seed-fråga (ny nyckel) — bara den seedas, en gång.
        using var db = TestDb.Create();
        await Seed(db);
        var skrappost = await db.FaqItems.SingleAsync(f => f.Fraga == FragaSkrappost);
        db.FaqItems.Remove(skrappost);
        db.AppliedSeeds.Remove(await db.AppliedSeeds.SingleAsync(a => a.Key == FaqSeeder.MarkorPrefix + "konto_skrappost"));
        // Admin har samtidigt raderat en annan seedad fråga — den ska INTE komma tillbaka.
        db.FaqItems.Remove(await db.FaqItems.SingleAsync(f => f.Fraga == FragaExport));
        await db.SaveChangesAsync();

        await Seed(db);
        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal(1, rader.Count(r => r.Fraga == FragaSkrappost));
        Assert.DoesNotContain(rader, r => r.Fraga == FragaExport);
        Assert.Equal(AntalFragor - 1, rader.Count);
    }

    [Fact]
    public async Task SeedAsync_AvbrutenForstaSeedning_FullbordasUtanDubbletter()
    {
        // Baslinjen sparas först. Kraschar processen mitt i seedningen ska nästa start fortsätta med resten,
        // inte tolka det som produktion (och inte seeda om det som redan finns).
        using var db = TestDb.Create();
        await Seed(db);
        var saknas = new[] { "Vad är en Polisen-bevakning?", FragaSkrappost, "Kan jag ångra en radering av mitt konto?" };
        db.FaqItems.RemoveRange(db.FaqItems.Where(f => saknas.Contains(f.Fraga)));
        db.AppliedSeeds.RemoveRange(db.AppliedSeeds.Where(a =>
            a.Key == FaqSeeder.MarkorPrefix + "kallor_polisen_bevakning"
            || a.Key == FaqSeeder.MarkorPrefix + "konto_skrappost"
            || a.Key == FaqSeeder.MarkorPrefix + "konto_angra_radering"));
        await db.SaveChangesAsync();

        await Seed(db);

        var rader = await Snapshot(db);
        Assert.Equal(AntalFragor, rader.Count);
        Assert.Equal(AntalFragor, rader.Select(r => r.Fraga).Distinct().Count());
    }

    [Fact]
    public async Task SeedAsync_FelIDatabasen_KastarInteOchLoggarError()
    {
        using var db = TestDb.Create();
        await db.Database.ExecuteSqlRawAsync("DROP TABLE \"AppliedSeeds\"");
        var logger = new ListLogger();

        var ex = await Record.ExceptionAsync(() => FaqSeeder.SeedAsync(db, logger));

        Assert.Null(ex);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Error && e.Ex != null);
        Assert.Empty(db.ChangeTracker.Entries());   // inget halvfärdigt lämnas kvar åt nästa SaveChanges i uppstarten
        Assert.Empty(await db.FaqItems.ToListAsync());
    }

    [Fact]
    public async Task SeedAsync_MarkortabellenSaknas_RorInteBefintligaFaqRader()
    {
        // Produktionsfallet men markörtabellen saknas (t.ex. migreringen har inte körts) — får inte skriva något
        // i FAQ-tabellen och får inte krascha.
        using var db = TestDb.Create();
        db.FaqItems.Add(new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = FragaRadera, Svar = "Admin." });
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync("DROP TABLE \"AppliedSeeds\"");

        var ex = await Record.ExceptionAsync(() => Seed(db));

        Assert.Null(ex);
        var rad = (await Snapshot(db)).Single();
        Assert.Equal("Admin.", rad.Svar);
        Assert.False(rad.Publicerad);
    }

    [Fact]
    public void SeedNycklar_AterAnvandsInteOchHarInteFragetexten()
    {
        Assert.Equal(FaqSeeder.AllaNycklar.Count, FaqSeeder.AllaNycklar.Distinct().Count());
        Assert.All(FaqSeeder.AllaNycklar, n => Assert.DoesNotContain(" ", n));
        Assert.Equal(AntalFragor + 2, FaqSeeder.AllaNycklar.Count);
    }
}
