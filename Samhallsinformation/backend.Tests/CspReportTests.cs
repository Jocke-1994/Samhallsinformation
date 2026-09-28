namespace Samhallsinformation.Tests;

using System.Net;
using System.Reflection;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Csp;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V3-22 (D4 alt B): CSP i rapportera-läge. Parser, tjänst (dedupe/tak/sanering), controller (alltid 204,
// anonym, rate limit) och larmregeln csp_violation. Riktig SQLite (TestDb) för tjänst och regel.
public class CspReportTests
{
    private static readonly DateTime Nu = new(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);

    private sealed class FixedTime : TimeProvider
    {
        public DateTime Now { get; set; } = Nu;
        public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(Now, DateTimeKind.Utc));
    }

    private static string Legacy(string blocked, string directive = "script-src-elem") =>
        $$$"""{"csp-report":{"document-uri":"https://samhallsinformation.se/?token=hemligt","blocked-uri":"{{{blocked}}}","effective-directive":"{{{directive}}}","violated-directive":"{{{directive}}}"}}""";

    private static string ReportingApi(string blocked, string directive = "script-src-elem") =>
        $$$"""[{"type":"csp-violation","url":"https://samhallsinformation.se/","body":{"blockedURL":"{{{blocked}}}","effectiveDirective":"{{{directive}}}","disposition":"report"}}]""";

    private static MemoryStream Body(string s) => new(Encoding.UTF8.GetBytes(s));

    private static CspReportService NewService(AppDbContext db, FixedTime? time = null) =>
        new(db, time ?? new FixedTime(), NullLogger<CspReportService>.Instance);

    private static Task<int> Send(CspReportService svc, string body) =>
        svc.HandleAsync(Body(body), Encoding.UTF8.GetByteCount(body), default);

    private static List<AdminActivityLog> CspRows(AppDbContext db) =>
        db.AdminActivityLogs.Where(l => l.Typ == LoggTyper.Säkerhet).ToList();

    // ── Parser ────────────────────────────────────────────────────────────────

    [Fact]
    public void Parser_LegacyReportUriFormat_ParsesDirectiveAndOrigin()
    {
        var v = Assert.Single(CspReportParser.Parse(Legacy("https://evil.example/x.js")));
        Assert.Equal("script-src-elem", v.Directive);
        Assert.Equal("https://evil.example", v.Origin);
    }

    [Fact]
    public void Parser_ReportingApiFormat_ParsesDirectiveAndOrigin()
    {
        var v = Assert.Single(CspReportParser.Parse(ReportingApi("https://evil.example/x.js", "img-src")));
        Assert.Equal("img-src", v.Directive);
        Assert.Equal("https://evil.example", v.Origin);
    }

    [Theory]
    [InlineData("https://evil.example/path/x.js?token=abc&user=a@b.se#frag", "https://evil.example")]
    [InlineData("https://EVIL.example:8443/x?y=1", "https://evil.example:8443")]
    [InlineData("https://user:lösen@evil.example/x", "https://evil.example")]
    [InlineData("https://evil.example:443/x", "https://evil.example")]
    [InlineData("wss://evil.example/socket?id=1", "wss://evil.example")]
    public void Parser_StripsPathQueryFragmentAndUserInfo(string blocked, string expectedOrigin)
    {
        var v = Assert.Single(CspReportParser.Parse(Legacy(blocked)));
        Assert.Equal(expectedOrigin, v.Origin);
    }

    [Theory]
    [InlineData("inline", "inline")]
    [InlineData("eval", "eval")]
    [InlineData("data", "data")]
    [InlineData("data:text/javascript,alert(1)", "data")]
    [InlineData("blob:https://samhallsinformation.se/abc-123", "blob")]
    [InlineData("https", "https")]
    public void Parser_KeepsKeywordsAndSchemeOnlyForDataAndBlob(string blocked, string expected)
    {
        var v = Assert.Single(CspReportParser.Parse(Legacy(blocked)));
        Assert.Equal(expected, v.Origin);
    }

    [Theory]
    [InlineData("chrome-extension://abcdefghijklmnop/content.js")]
    [InlineData("moz-extension://uuid/inject.js")]
    [InlineData("safari-web-extension://x/y.js")]
    [InlineData("javascript:alert(1)")]
    [InlineData("")]
    public void Parser_SkipsBrowserExtensionsAndUnknownSchemes(string blocked)
    {
        Assert.Empty(CspReportParser.Parse(Legacy(blocked)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("detta är inte JSON")]
    [InlineData("{")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("123")]
    [InlineData("null")]
    [InlineData("\"bara en sträng\"")]
    [InlineData("""{"csp-report":"fel typ"}""")]
    [InlineData("""{"csp-report":{"blocked-uri":42,"effective-directive":["x"]}}""")]
    [InlineData("""[1,2,"x",null,{"body":5}]""")]
    [InlineData("""[{"type":"deprecation","body":{"blockedURL":"https://x.example","effectiveDirective":"script-src"}}]""")]
    public void Parser_JunkNeverThrowsAndGivesNothing(string? body)
    {
        Assert.Empty(CspReportParser.Parse(body));
    }

    [Fact]
    public void Parser_DeeplyNestedJson_DoesNotThrow()
    {
        var deep = new string('[', 5000) + new string(']', 5000);
        Assert.Empty(CspReportParser.Parse(deep));
    }

    [Fact]
    public void Parser_ViolatedDirectiveWithSourceList_KeepsOnlyDirectiveName()
    {
        var body = """{"csp-report":{"blocked-uri":"https://evil.example/a.js","violated-directive":"script-src 'self' https://x.example"}}""";
        var v = Assert.Single(CspReportParser.Parse(body));
        Assert.Equal("script-src", v.Directive);
    }

    [Theory]
    [InlineData("SCRIPT-SRC; drop table")]
    [InlineData("script src")]
    [InlineData("<script>")]
    [InlineData("x")]
    public void Parser_RejectsMalformedDirective(string directive)
    {
        var body = $$$"""{"csp-report":{"blocked-uri":"https://evil.example/a.js","effective-directive":"{{{directive}}}"}}""";
        var res = CspReportParser.Parse(body);
        // "SCRIPT-SRC; drop table" -> första ordet "script-src;" ogiltigt, "script src" -> "script" giltigt men harmlöst.
        Assert.All(res, v => Assert.Matches("^[a-z][a-z-]{0,39}$", v.Directive));
    }

    [Fact]
    public void Parser_CapsNumberOfViolationsPerBody()
    {
        var items = string.Join(",", Enumerable.Range(0, 50).Select(i =>
            $$$"""{"type":"csp-violation","body":{"blockedURL":"https://h{{{i}}}.example/x","effectiveDirective":"img-src"}}"""));
        Assert.Equal(CspReportParser.MaxViolationsPerBody, CspReportParser.Parse($"[{items}]").Count);
    }

    // ── Tjänsten: lagring, dedupe, tak, sanering ──────────────────────────────

    [Fact]
    public async Task Service_ValidReport_StoresOneSanitizedRowWithoutPersonalData()
    {
        using var db = TestDb.Create();

        var added = await Send(NewService(db), Legacy("https://evil.example/x.js?token=hemligt#a"));

        Assert.Equal(1, added);
        var row = Assert.Single(CspRows(db));
        Assert.Equal("Säkerhet", row.Typ);
        Assert.Equal("System", row.AktörTyp);
        Assert.Equal("script-src-elem: https://evil.example", row.Detalj);
        Assert.Null(row.Ip);
        Assert.Null(row.Enhet);
        Assert.DoesNotContain("token", row.Detalj + row.Rubrik);
        Assert.DoesNotContain("hemligt", row.Detalj + row.Rubrik);
        Assert.DoesNotContain("#", row.Detalj);
    }

    [Fact]
    public async Task Service_ReportingApiFormat_IsStoredToo()
    {
        using var db = TestDb.Create();
        await Send(NewService(db), ReportingApi("https://evil.example/a.js"));
        Assert.Equal("script-src-elem: https://evil.example", Assert.Single(CspRows(db)).Detalj);
    }

    [Fact]
    public async Task Service_SameReportTwice_GivesOneRow()
    {
        using var db = TestDb.Create();
        var svc = NewService(db);

        Assert.Equal(1, await Send(svc, Legacy("https://evil.example/a.js")));
        Assert.Equal(0, await Send(svc, Legacy("https://evil.example/b.js?x=1")));   // annan sökväg, samma origin

        Assert.Single(CspRows(db));
    }

    [Fact]
    public async Task Service_SameOriginDifferentDirective_GivesTwoRows()
    {
        using var db = TestDb.Create();
        var svc = NewService(db);

        await Send(svc, Legacy("https://evil.example/a", "script-src-elem"));
        await Send(svc, Legacy("https://evil.example/a", "img-src"));

        Assert.Equal(2, CspRows(db).Count);
    }

    [Fact]
    public async Task Service_SameViolationInOneBatch_IsLoggedOnce()
    {
        using var db = TestDb.Create();
        var one = """{"type":"csp-violation","body":{"blockedURL":"https://evil.example/a","effectiveDirective":"img-src"}}""";

        await Send(NewService(db), $"[{one},{one},{one}]");

        Assert.Single(CspRows(db));
    }

    [Fact]
    public async Task Service_SameViolationAfterDedupeWindow_IsLoggedAgain()
    {
        using var db = TestDb.Create();
        var time = new FixedTime();
        var svc = NewService(db, time);

        await Send(svc, Legacy("https://evil.example/a"));
        time.Now = Nu.AddHours(23);
        Assert.Equal(0, await Send(svc, Legacy("https://evil.example/a")));
        time.Now = Nu.AddHours(24).AddMinutes(1);
        Assert.Equal(1, await Send(svc, Legacy("https://evil.example/a")));

        Assert.Equal(2, CspRows(db).Count);
    }

    [Fact]
    public async Task Service_CapsNumberOfScriptRows_AndKeepsLoggingNonScriptViolations()
    {
        using var db = TestDb.Create();
        var svc = NewService(db);

        for (var i = 0; i < CspReportService.MaxScriptRowsPerWindow + 10; i++)
            await Send(svc, Legacy($"https://s{i}.example/a.js"));

        var scriptRows = CspRows(db).Count(r => r.Detalj.StartsWith("script-src-elem"));
        Assert.Equal(CspReportService.MaxScriptRowsPerWindow, scriptRows);

        // Skriptkvoten är full, men en bildöverträdelse tränger inte ut — och tvärtom (eget tak per kategori).
        Assert.Equal(1, await Send(svc, Legacy("https://bild.example/a.png", "img-src")));
    }

    [Fact]
    public async Task Service_ImageFlood_DoesNotCrowdOutAScriptSource()
    {
        using var db = TestDb.Create();
        var svc = NewService(db);

        for (var i = 0; i < CspReportService.MaxOtherRowsPerWindow + 20; i++)
            await Send(svc, Legacy($"https://i{i}.example/a.png", "img-src"));

        Assert.Equal(CspReportService.MaxOtherRowsPerWindow, CspRows(db).Count);
        Assert.Equal(1, await Send(svc, Legacy("https://evil.example/a.js")));
    }

    [Fact]
    public async Task Service_CapResetsWhenWindowPasses()
    {
        using var db = TestDb.Create();
        var time = new FixedTime();
        var svc = NewService(db, time);
        for (var i = 0; i < CspReportService.MaxScriptRowsPerWindow; i++)
            await Send(svc, Legacy($"https://s{i}.example/a.js"));

        time.Now = Nu.AddHours(25);

        Assert.Equal(1, await Send(svc, Legacy("https://ny.example/a.js")));
    }

    [Fact]
    public async Task Service_ContentLengthOverLimit_IsIgnoredWithoutReadingOrThrowing()
    {
        using var db = TestDb.Create();
        var stream = Substitute.For<Stream>();   // ska aldrig läsas när Content-Length redan är för stor

        var added = await NewService(db).HandleAsync(stream, CspReportService.MaxBodyBytes + 1, default);

        Assert.Equal(0, added);
        Assert.Empty(CspRows(db));
        await stream.DidNotReceiveWithAnyArgs().ReadAsync(default(Memory<byte>), default);
    }

    [Fact]
    public async Task Service_OversizedBodyWithoutContentLength_IsIgnored()
    {
        using var db = TestDb.Create();
        var padding = new string('a', CspReportService.MaxBodyBytes);
        var body = Legacy("https://evil.example/a.js").Replace("{\"csp-report\":{", $"{{\"csp-report\":{{\"pad\":\"{padding}\",");

        var added = await NewService(db).HandleAsync(Body(body), null, default);

        Assert.Equal(0, added);
        Assert.Empty(CspRows(db));
    }

    [Theory]
    [InlineData("")]
    [InlineData("skräp, inte JSON")]
    [InlineData("{\"csp-report\": 5}")]
    [InlineData("[[[[")]
    public async Task Service_EmptyOrGarbageBody_StoresNothingAndDoesNotThrow(string body)
    {
        using var db = TestDb.Create();
        Assert.Equal(0, await Send(NewService(db), body));
        Assert.Empty(CspRows(db));
    }

    private sealed class ThrowingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new IOException("klienten kopplade ned");
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => throw new IOException("klienten kopplade ned");
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    [Fact]
    public async Task Service_StreamFailure_IsSwallowed()
    {
        using var db = TestDb.Create();
        Assert.Equal(0, await NewService(db).HandleAsync(new ThrowingStream(), null, default));
    }

    [Fact]
    public async Task Service_DatabaseFailure_IsSwallowed()
    {
        var db = TestDb.Create();
        var svc = NewService(db);
        db.Dispose(); // databasen är borta — rapporten ska ändå inte ge fel

        Assert.Equal(0, await Send(svc, Legacy("https://evil.example/a.js")));
    }

    // ── Controller ────────────────────────────────────────────────────────────

    private static CspReportController NewController(AppDbContext db, string body, long? contentLength = null)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Body = Body(body);
        ctx.Request.ContentType = "application/csp-report";
        ctx.Request.ContentLength = contentLength ?? Encoding.UTF8.GetByteCount(body);
        return new CspReportController(NewService(db)) { ControllerContext = new ControllerContext { HttpContext = ctx } };
    }

    [Fact]
    public async Task Controller_ValidReport_Returns204AndOneRow()
    {
        using var db = TestDb.Create();

        var result = await NewController(db, Legacy("https://evil.example/a.js")).Receive(default);

        Assert.IsType<NoContentResult>(result);
        Assert.Single(CspRows(db));
    }

    [Theory]
    [InlineData("")]
    [InlineData("skräp")]
    [InlineData("{\"csp-report\":{\"blocked-uri\":\"https://evil.example\"}}")]   // direktiv saknas
    public async Task Controller_JunkOrEmptyBody_Returns204NotAnError(string body)
    {
        using var db = TestDb.Create();

        var result = await NewController(db, body).Receive(default);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(CspRows(db));
    }

    [Fact]
    public async Task Controller_TooLargeBody_Returns204AndStoresNothing()
    {
        using var db = TestDb.Create();
        var body = Legacy("https://evil.example/a.js");

        var result = await NewController(db, body, contentLength: 1_000_000).Receive(default);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(CspRows(db));
    }

    [Fact]
    public void Controller_IsAnonymous_PostOnly_AndRateLimited()
    {
        var method = typeof(CspReportController).GetMethod(nameof(CspReportController.Receive))!;

        Assert.NotNull(method.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.Equal("/api/csp-report", method.GetCustomAttribute<HttpPostAttribute>()!.Template);
        Assert.Equal(CspReportRateLimit.PolicyName, method.GetCustomAttribute<EnableRateLimitingAttribute>()!.PolicyName);
    }

    // ── Rate limit ────────────────────────────────────────────────────────────

    private static HttpContext FromIp(string ip)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return ctx;
    }

    [Fact]
    public void RateLimit_Policy_Allows30PerMinutePerIp()
    {
        Assert.Equal("csp-report", CspReportRateLimit.PolicyName);
        Assert.Equal(TimeSpan.FromMinutes(1), CspReportRateLimit.Window);

        var partition = CspReportRateLimit.GetPartition(FromIp("203.0.113.5"));
        using var limiter = partition.Factory(partition.PartitionKey);
        var permitted = 0;
        for (var i = 0; i < 100; i++)
        {
            using var lease = limiter.AttemptAcquire();
            if (lease.IsAcquired) permitted++;
        }

        Assert.Equal(30, permitted);
    }

    [Fact]
    public void RateLimit_PartitionsPerIp_AndNormalizesIpv6To64()
    {
        Assert.NotEqual(
            CspReportRateLimit.GetPartition(FromIp("203.0.113.5")).PartitionKey,
            CspReportRateLimit.GetPartition(FromIp("203.0.113.6")).PartitionKey);
        Assert.Equal(
            CspReportRateLimit.GetPartition(FromIp("2001:db8:1:2::1")).PartitionKey,
            CspReportRateLimit.GetPartition(FromIp("2001:db8:1:2:ffff::9")).PartitionKey);
    }

    // ── Larmregeln csp_violation ──────────────────────────────────────────────

    private static async Task<IReadOnlyList<AlertCandidate>> Evaluate(AppDbContext db, DateTime? now = null) =>
        await new CspViolationRule().EvaluateAsync(db, now ?? Nu, default);

    [Theory]
    [InlineData("script-src-elem")]
    [InlineData("script-src")]
    public async Task Rule_UnexpectedScriptSource_Raises(string directive)
    {
        using var db = TestDb.Create();
        await Send(NewService(db), Legacy("https://evil.example/x.js", directive));

        var c = Assert.Single(await Evaluate(db));

        Assert.Equal($"csp_violation:{directive}:https://evil.example", c.Key);
        Assert.Equal(AlertSeverity.Warning, c.Severity);
        Assert.Contains("https://evil.example", c.Title);
        Assert.Contains("alt C", c.Detail);
    }

    [Theory]
    [InlineData("img-src")]
    [InlineData("font-src")]
    [InlineData("style-src-elem")]
    [InlineData("connect-src")]
    [InlineData("frame-src")]
    public async Task Rule_NonScriptViolation_DoesNotRaise(string directive)
    {
        using var db = TestDb.Create();
        await Send(NewService(db), Legacy("https://bild.example/a.png", directive));

        Assert.Single(CspRows(db));            // loggas...
        Assert.Empty(await Evaluate(db));      // ...men larmar inte
    }

    [Theory]
    [InlineData("inline")]
    [InlineData("eval")]
    [InlineData("data")]
    public async Task Rule_ScriptKeywordWithoutOrigin_DoesNotRaise(string blocked)
    {
        using var db = TestDb.Create();
        await Send(NewService(db), Legacy(blocked, "script-src-elem"));

        Assert.Single(CspRows(db));
        Assert.Empty(await Evaluate(db));
    }

    [Fact]
    public async Task Rule_OneAlertPerUniqueViolation()
    {
        using var db = TestDb.Create();
        var svc = NewService(db);
        await Send(svc, Legacy("https://a.example/x.js"));
        await Send(svc, Legacy("https://a.example/y.js"));   // dedupas i tjänsten
        await Send(svc, Legacy("https://b.example/x.js"));
        await Send(svc, Legacy("https://b.example/x.js", "script-src"));

        Assert.Equal(3, (await Evaluate(db)).Count);
    }

    [Fact]
    public async Task Rule_IgnoresRowsOfOtherTypesAndOldRows()
    {
        using var db = TestDb.Create();
        db.AdminActivityLogs.Add(new AdminActivityLog { Typ = "Konfiguration", Rubrik = CspLogFormat.Rubrik, Detalj = "script-src-elem: https://fel-typ.example" });
        db.AdminActivityLogs.Add(new AdminActivityLog { Typ = LoggTyper.Säkerhet, Rubrik = CspLogFormat.Rubrik, Detalj = "script-src-elem: https://gammal.example", Tid = Nu.AddHours(-26) });
        db.AdminActivityLogs.Add(new AdminActivityLog { Typ = LoggTyper.Säkerhet, Rubrik = CspLogFormat.Rubrik, Detalj = "trasigt utan avdelare", Tid = Nu });
        await db.SaveChangesAsync();

        Assert.Empty(await Evaluate(db));
    }

    private static AdminAlertCycle NewCycle(AppDbContext db, IEmailService email) =>
        new(db, [new CspViolationRule()], email, new ConfigurationBuilder().Build(), NullLogger<AdminAlertCycle>.Instance);

    [Fact]
    public async Task Rule_ThroughAlertCycle_MailsOnceThenResolvesAfterQuietPeriod()
    {
        using var db = TestDb.Create();
        db.Users.Add(new User { Name = "Admin", Email = "admin@example.se", PasswordHash = "x", Role = "Admin", IsActive = true });
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();
        var time = new FixedTime();
        var svc = NewService(db, time);
        var cycle = NewCycle(db, email);

        await Send(svc, Legacy("https://evil.example/x.js"));
        await cycle.RunAsync(Nu);
        await cycle.RunAsync(Nu.AddMinutes(5));    // samma överträdelse igen — inget nytt mejl

        var alert = Assert.Single(db.AdminAlerts);
        Assert.Equal("csp_violation", alert.RuleId);
        Assert.Null(alert.ResolvedAt);
        Assert.Equal(1, email.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync)));

        // Dedupen loggar en pågående överträdelse på nytt efter 24 h — larmet hinner inte lösas i glappet.
        time.Now = Nu.AddHours(24).AddMinutes(1);
        await Send(svc, Legacy("https://evil.example/x.js"));
        await cycle.RunAsync(time.Now);
        Assert.Null(db.AdminAlerts.Single().ResolvedAt);
        Assert.Equal(1, email.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync)));

        // Inga fler träffar: larmet löses när sista raden är äldre än 25 h.
        await cycle.RunAsync(time.Now.AddHours(26));
        Assert.NotNull(db.AdminAlerts.Single().ResolvedAt);
    }
}
