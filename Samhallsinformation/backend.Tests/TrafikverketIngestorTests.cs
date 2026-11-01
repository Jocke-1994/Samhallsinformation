namespace Samhallsinformation.Tests;

using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Samhallsinformation.Ingestors;
using Xunit;

/// <summary>
/// V4-1b (E3#13): Trafikverket-frågan hade tidigare varken sortering eller paginering —
/// bara <c>limit="100"</c>, i den ordning API:et råkade lämna träffarna. Fler än 100
/// samtidigt aktiva situationer kunde alltså tystnas ned helt slumpmässigt. Nu sorteras
/// frågan på senast ändrad (fallande) och gränsen är höjd till 500 som ett enkelt
/// skyddsnät (riktig delta/paginering är en uppföljning, se kommentaren i ingestorn).
/// </summary>
public class TrafikverketIngestorTests
{
    private const string EnSituation =
        """{"RESPONSE":{"RESULT":[{"Situation":[{"Id":"s1","Deviation":[{"Id":"d1","Header":"Vägarbete","CountyNo":[14]}]}]}]}}""";

    private sealed class CapturingHandler(string json) : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }
        public int Calls { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            RequestBody = request.Content == null ? null : await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }
    }

    private static (TrafikverketApiIngestor Ingestor, CapturingHandler Handler) Build(string json = EnSituation)
    {
        var handler = new CapturingHandler(json);
        var ingestor = new TrafikverketApiIngestor(new HttpClient(handler), NullLogger<TrafikverketApiIngestor>.Instance);
        return (ingestor, handler);
    }

    // TRAFIKVERKET_API_KEY läses en gång i konstruktorn (process-global miljövariabel) —
    // måste sättas INNAN ingestorn skapas, och återställas efteråt så andra tester i
    // samma testkörning inte påverkas.
    private sealed class MedApiNyckel : IDisposable
    {
        private readonly string? _tidigare;

        public MedApiNyckel()
        {
            _tidigare = Environment.GetEnvironmentVariable("TRAFIKVERKET_API_KEY");
            Environment.SetEnvironmentVariable("TRAFIKVERKET_API_KEY", "test-nyckel");
        }

        public void Dispose() => Environment.SetEnvironmentVariable("TRAFIKVERKET_API_KEY", _tidigare);
    }

    [Fact]
    public async Task FetchEvents_Query_InnehallerSorteringPaSenastAndrad()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, handler) = Build();

        await ingestor.FetchEventsAsync();

        Assert.Equal(1, handler.Calls);
        Assert.NotNull(handler.RequestBody);
        Assert.Contains("orderby=\"ModifiedTime desc\"", handler.RequestBody);
    }

    [Fact]
    public async Task FetchEvents_Query_GransenArHojd_InteLangre100()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, handler) = Build();

        await ingestor.FetchEventsAsync();

        Assert.NotNull(handler.RequestBody);
        Assert.DoesNotContain("limit=\"100\"", handler.RequestBody);
        Assert.Contains("limit=\"500\"", handler.RequestBody);
    }

    // Driftstörningen 2026-10-21: Trafikverket kan svara 200 OK med felet inbäddat i
    // RESULT[].ERROR, eller med en tom lista. Båda måste kasta så IngestorBackgroundService
    // loggar en misslyckad körning och SourceFailingRule kan larma — inte räknas som lyckad.
    [Fact]
    public async Task FetchEvents_ErrorIResultat_KastarMedTrafikverketsMeddelande()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, _) = Build("""{"RESPONSE":{"RESULT":[{"ERROR":{"SOURCE":"Request","MESSAGE":"Internal error"}}]}}""");

        var ex = await Assert.ThrowsAsync<HttpRequestException>(ingestor.FetchEventsAsync);

        Assert.Contains("Internal error", ex.Message);
    }

    [Fact]
    public async Task FetchEvents_NollSituationer_Kastar()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, _) = Build("""{"RESPONSE":{"RESULT":[{"Situation":[]}]}}""");

        await Assert.ThrowsAsync<HttpRequestException>(ingestor.FetchEventsAsync);
    }

    [Fact]
    public async Task FetchEvents_TomtSvar_Kastar()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, _) = Build("""{"RESPONSE":{"RESULT":[]}}""");

        await Assert.ThrowsAsync<HttpRequestException>(ingestor.FetchEventsAsync);
    }

    [Fact]
    public async Task FetchEvents_MedSituationer_ReturnerarHandelser()
    {
        using var _ = new MedApiNyckel();
        var (ingestor, _) = Build();

        var events = await ingestor.FetchEventsAsync();

        var ev = Assert.Single(events);
        Assert.Equal("Vägarbete", ev.Title);
    }

    [Fact]
    public async Task FetchEvents_UtanApiNyckel_ReturnerarTomLista_UtanAttAnropaApi()
    {
        var tidigare = Environment.GetEnvironmentVariable("TRAFIKVERKET_API_KEY");
        Environment.SetEnvironmentVariable("TRAFIKVERKET_API_KEY", null);
        try
        {
            var (ingestor, handler) = Build();

            var events = await ingestor.FetchEventsAsync();

            Assert.Empty(events);
            Assert.Equal(0, handler.Calls);
        }
        finally
        {
            Environment.SetEnvironmentVariable("TRAFIKVERKET_API_KEY", tidigare);
        }
    }
}
