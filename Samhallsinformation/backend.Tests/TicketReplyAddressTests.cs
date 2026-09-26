namespace Samhallsinformation.Tests;

using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging.Abstractions;
using Samhallsinformation.Services;
using Xunit;

// E1#10 / V3-16: svarsadressens icke-gissningsbara token (TicketReplyAddress) och hur
// ResendEmailService bygger Reply-To samt tolkar SPF/DKIM/DMARC ur Resends Received Emails-API.
public class TicketReplyAddressTests
{
    private static readonly TicketReplyAddress Adress = new("hemlighet-hemlighet-hemlighet-0123456789");

    [Fact]
    public void Build_GerTicketnummerOchAttaHexTecken()
    {
        var adress = Adress.Build(42);

        Assert.Matches(new Regex(@"^svar\+42-[0-9a-f]{8}@samhallsinformation\.se$"), adress);
    }

    [Fact]
    public void ComputeToken_ArDeterministiskForSammaNummerOchHemlighet()
    {
        Assert.Equal(Adress.ComputeToken(7), Adress.ComputeToken(7));
        Assert.Equal(Adress.ComputeToken(7), new TicketReplyAddress("hemlighet-hemlighet-hemlighet-0123456789").ComputeToken(7));
    }

    [Fact]
    public void ComputeToken_SkiljerSigMellanArendenOchHemligheter()
    {
        var tokens = Enumerable.Range(1, 200).Select(Adress.ComputeToken).ToHashSet();

        Assert.Equal(200, tokens.Count);   // inga kollisioner i ett realistiskt intervall
        Assert.NotEqual(Adress.ComputeToken(7), new TicketReplyAddress("en-annan-hemlighet-0123456789").ComputeToken(7));
    }

    [Fact]
    public void IsValid_AcceptarRattTokenOchAvvisarResten()
    {
        var token = Adress.ComputeToken(7);

        Assert.True(Adress.IsValid(7, token));
        Assert.True(Adress.IsValid(7, token.ToUpperInvariant()));
        Assert.False(Adress.IsValid(8, token));                 // annat ärendenummer, samma token
        Assert.False(Adress.IsValid(7, "00000000"));
        Assert.False(Adress.IsValid(7, token[..7]));            // för kort
        Assert.False(Adress.IsValid(7, token + "0"));           // för lång
        Assert.False(Adress.IsValid(7, ""));
        Assert.False(Adress.IsValid(7, null));
    }

    [Fact]
    public void Konstruktor_AvvisarTomHemlighet()
    {
        Assert.Throws<ArgumentException>(() => new TicketReplyAddress(""));
        Assert.Throws<ArgumentException>(() => new TicketReplyAddress("   "));
    }

    [Fact]
    public void Token_ArInteJwtHemligheten_ElleravleddRakt()
    {
        // Nyckeln härleds med en kontext-sträng, så token får inte råka vara en rak HMAC av numret med hemligheten.
        var rak = Convert.ToHexString(System.Security.Cryptography.HMACSHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("hemlighet-hemlighet-hemlighet-0123456789"),
            System.Text.Encoding.UTF8.GetBytes("7")))[..8].ToLowerInvariant();

        Assert.NotEqual(rak, Adress.ComputeToken(7));
    }

    // ---- ResendEmailService ----

    private sealed class FakeResendHandler : HttpMessageHandler
    {
        public string? PostBody { get; private set; }
        public string? GetPath { get; private set; }
        public HttpStatusCode Status { get; init; } = HttpStatusCode.OK;
        public string ResponseBody { get; init; } = "{}";

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Method == HttpMethod.Post) PostBody = await request.Content!.ReadAsStringAsync(ct);
            else GetPath = request.RequestUri!.AbsolutePath;
            return new HttpResponseMessage(Status) { Content = new StringContent(ResponseBody) };
        }
    }

    private static ResendEmailService NewService(FakeResendHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com") },
            NullLogger<ResendEmailService>.Instance, Adress);

    [Fact]
    public async Task Arendesvar_SattarReplyToMedToken()
    {
        var handler = new FakeResendHandler();

        await NewService(handler).SendTicketReplyAsync("kund@example.com", 42, "Ämne", "Svar");

        using var doc = JsonDocument.Parse(handler.PostBody!);
        Assert.Equal(Adress.Build(42), doc.RootElement.GetProperty("reply_to").GetString());
    }

    [Fact]
    public async Task HamtatMejl_ParsarAutentiseringOchText()
    {
        var handler = new FakeResendHandler
        {
            ResponseBody = """{"id":"em_1","text":"Hej","html":null,"authentication":{"spf":"pass","dkim":"gray","dmarc":"pass"}}""",
        };

        var mejl = await NewService(handler).GetReceivedEmailAsync("em_1");

        Assert.NotNull(mejl);
        Assert.Equal("Hej", mejl!.Text);
        Assert.Equal(new ReceivedEmailAuthentication("pass", "gray", "pass"), mejl.Authentication);
        Assert.True(mejl.Authentication!.IsSenderVerified);
        Assert.Equal("/emails/receiving/em_1", handler.GetPath);
    }

    [Theory]
    [InlineData("""{"text":"Hej","authentication":null}""")]
    [InlineData("""{"text":"Hej"}""")]
    [InlineData("""{"text":"Hej","authentication":"pass"}""")]
    public async Task HamtatMejl_UtanAutentiseringsobjekt_GerNullAutentisering(string json)
    {
        var mejl = await NewService(new FakeResendHandler { ResponseBody = json }).GetReceivedEmailAsync("em_1");

        Assert.NotNull(mejl);
        Assert.Null(mejl!.Authentication);
    }

    [Fact]
    public async Task HamtatMejl_OnlyHtml_FallerTillbakaPaTextMenBehallerAutentisering()
    {
        var handler = new FakeResendHandler
        {
            ResponseBody = """{"text":null,"html":"<p>Hej<br>där</p>","authentication":{"spf":"fail","dkim":"fail","dmarc":"fail"}}""",
        };

        var mejl = await NewService(handler).GetReceivedEmailAsync("em_1");

        Assert.Equal("Hej\ndär", mejl!.Text);
        Assert.False(mejl.Authentication!.IsSenderVerified);
    }

    [Fact]
    public async Task HamtatMejl_HttpFel_GerNull()
    {
        var handler = new FakeResendHandler { Status = HttpStatusCode.NotFound, ResponseBody = "{\"message\":\"nej\"}" };

        Assert.Null(await NewService(handler).GetReceivedEmailAsync("em_1"));
    }

    [Fact]
    public async Task HamtatMejl_EmailIdMedSkraptecken_KodasISokvagen()
    {
        var handler = new FakeResendHandler { ResponseBody = """{"text":"x"}""" };

        await NewService(handler).GetReceivedEmailAsync("../emails/abc");

        Assert.DoesNotContain("/../", handler.GetPath);
    }

    [Fact]
    public async Task GetReceivedEmailTextAsync_GerFortfarandeBaraTexten()
    {
        var handler = new FakeResendHandler { ResponseBody = """{"text":"Hej","authentication":{"spf":"fail","dkim":"fail","dmarc":"fail"}}""" };

        Assert.Equal("Hej", await NewService(handler).GetReceivedEmailTextAsync("em_1"));
    }

    [Theory]
    [InlineData("pass", "pass", "pass", true)]
    [InlineData("fail", "fail", "pass", true)]
    [InlineData("gray", "pass", "gray", true)]
    [InlineData("pass", "gray", "gray", false)]
    [InlineData("pass", "fail", "fail", false)]
    [InlineData(null, null, null, false)]
    public void IsSenderVerified_RaknarBaraDmarcEllerDkimPass(string? spf, string? dkim, string? dmarc, bool förväntat)
    {
        Assert.Equal(förväntat, new ReceivedEmailAuthentication(spf, dkim, dmarc).IsSenderVerified);
    }
}
