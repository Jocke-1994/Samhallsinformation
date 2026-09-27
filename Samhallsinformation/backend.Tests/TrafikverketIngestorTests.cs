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
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }
        public int Calls { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            RequestBody = request.Content == null ? null : await request.Content.ReadAsStringAsync(ct);
            const string json = """{"RESPONSE":{"RESULT":[{"Situation":[]}]}}""";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }
    }

    private static (TrafikverketApiIngestor Ingestor, CapturingHandler Handler) Build()
    {
        var handler = new CapturingHandler();
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
