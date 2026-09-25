namespace Samhallsinformation.Tests;

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// Regressionstester för E7#2 / V1-6: länkkollen ("Läs mer hos källan") har tre
// lägen. Bara ett ENTYDIGT dött svar (404/410) får ge "dead" — timeout, 403,
// 5xx och nätverksfel betyder "unknown" och får aldrig få UI:t att påstå att
// sidan är borta.
public class EventsControllerLinkStatusTests
{
    // Fejkad utgående klient: returnerar valfri statuskod eller kastar valfritt undantag.
    private sealed class FejkHandler(Func<HttpResponseMessage> svar) : HttpMessageHandler
    {
        public int Anrop { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Anrop++;
            return Task.FromResult(svar());
        }
    }

    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<(string Status, bool Alive)> KollaAsync(HttpMessageHandler handler)
    {
        using var db = NewDb();
        var evt = new CanonicalEvent { SourceId = 1, Title = "x", Content = "x", Url = "https://kalla.example/1" };
        db.Events.Add(evt);
        await db.SaveChangesAsync();

        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("linkcheck").Returns(new HttpClient(handler));

        var controller = new EventsController(db, factory);
        var result = Assert.IsType<OkObjectResult>(await controller.GetLinkStatus(evt.Id));

        // Serialisera som ramverket gör, så testet bevisar det fält klienten faktiskt får.
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(result.Value));
        return (json.RootElement.GetProperty("status").GetString()!, json.RootElement.GetProperty("alive").GetBoolean());
    }

    private static FejkHandler Svarar(HttpStatusCode kod) => new(() => new HttpResponseMessage(kod));

    [Fact]
    public async Task GetLinkStatus_200_ArAlive()
    {
        var (status, alive) = await KollaAsync(Svarar(HttpStatusCode.OK));

        Assert.Equal("alive", status);
        Assert.True(alive);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.Gone)]
    public async Task GetLinkStatus_404Och410_ArDead(HttpStatusCode kod)
    {
        var (status, alive) = await KollaAsync(Svarar(kod));

        Assert.Equal("dead", status);
        Assert.False(alive);
    }

    // 403 = bot-blockering/WAF, 429 = rate limit, 405 = metod nekad, 5xx = källan
    // har problem. Inget av det säger att sidan saknas.
    [Theory]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.MethodNotAllowed)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    public async Task GetLinkStatus_ForbiddenOch5xx_ArUnknown_InteDead(HttpStatusCode kod)
    {
        var (status, alive) = await KollaAsync(Svarar(kod));

        Assert.Equal("unknown", status);
        Assert.True(alive); // bakåtkompatibelt fält: false bara vid "dead"
    }

    [Fact]
    public async Task GetLinkStatus_Timeout_ArUnknown()
    {
        // HttpClient.Timeout ger TaskCanceledException (en OperationCanceledException).
        var (status, alive) = await KollaAsync(new FejkHandler(() => throw new TaskCanceledException("timeout")));

        Assert.Equal("unknown", status);
        Assert.True(alive);
    }

    [Fact]
    public async Task GetLinkStatus_Natverksfel_ArUnknown()
    {
        var (status, _) = await KollaAsync(new FejkHandler(() => throw new HttpRequestException("DNS-fel")));

        Assert.Equal("unknown", status);
    }

    [Fact]
    public async Task GetLinkStatus_OkandHandelse_Ger404_UtanUtgaendeAnrop()
    {
        using var db = NewDb();
        var factory = Substitute.For<IHttpClientFactory>();

        var result = await new EventsController(db, factory).GetLinkStatus(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
        factory.DidNotReceiveWithAnyArgs().CreateClient(default!);
    }
}
