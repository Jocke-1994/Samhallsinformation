namespace Samhallsinformation.Tests;

using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Infrastructure;
using Samhallsinformation.Infrastructure.Auth;
using Samhallsinformation.Models;
using Xunit;

// V3-15 (E1#2): fail-fast på saknade/dev-hemligheter utanför Development, ingen privat VAPID-nyckel
// i källkoden och en enda källa för JWT-hemligheten (signering och validering delar JwtSettings).
public class StartupSecretsGuardTests
{
    // Testnycklar — påhittade, inte kopplade till något riktigt system.
    private const string GoodJwt     = "test-only-jwt-secret-that-is-long-enough-0123456789";
    private const string GoodVapidPub  = "BTestOnlyPublicKeyNotARealVapidKey_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private const string GoodVapidPriv = "TestOnlyPrivateKeyNotARealOne_aaaaaaaaaaaa";

    private sealed class FakeEnv(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Test";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class CapturingLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception)));
    }

    private static IConfiguration Config(string? jwt = GoodJwt, string? pub = GoodVapidPub, string? priv = GoodVapidPriv)
    {
        var d = new Dictionary<string, string?>();
        if (jwt != null)  d["JWT_SECRET"]        = jwt;
        if (pub != null)  d["VAPID_PUBLIC_KEY"]  = pub;
        if (priv != null) d["VAPID_PRIVATE_KEY"] = priv;
        return new ConfigurationBuilder().AddInMemoryCollection(d).Build();
    }

    // --- Vakten: Production ---

    [Fact]
    public void Validate_ProductionUtanJwtSecret_Kastar_MeddelandetNamnerVariabelnMenInteVarden()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(jwt: null), new FakeEnv("Production")));

        Assert.Contains("JWT_SECRET", ex.Message);
        Assert.DoesNotContain(GoodVapidPub, ex.Message);
        Assert.DoesNotContain(GoodVapidPriv, ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_ProductionTomEllerBlankJwtSecret_Kastar(string jwt)
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(jwt: jwt), new FakeEnv("Production")));

        Assert.Contains("JWT_SECRET", ex.Message);
    }

    [Fact]
    public void Validate_ProductionJwtSecretArDevFallbackSträngen_Kastar_UtanAttEchoaVarden()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(jwt: JwtSettings.DevFallbackSecret), new FakeEnv("Production")));

        Assert.Contains("JWT_SECRET", ex.Message);
        Assert.DoesNotContain(JwtSettings.DevFallbackSecret, ex.Message);
    }

    [Theory]
    [InlineData("VAPID_PRIVATE_KEY")]
    [InlineData("VAPID_PUBLIC_KEY")]
    public void Validate_ProductionSaknarVapid_Kastar_OchNamnerRättVariabel(string missing)
    {
        var config = Config(
            pub:  missing == "VAPID_PUBLIC_KEY"  ? null : GoodVapidPub,
            priv: missing == "VAPID_PRIVATE_KEY" ? null : GoodVapidPriv);

        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(config, new FakeEnv("Production")));

        Assert.Contains(missing, ex.Message);
    }

    [Fact]
    public void Validate_ProductionTomVapidPrivateKey_Kastar()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(priv: "  "), new FakeEnv("Production")));

        Assert.Contains("VAPID_PRIVATE_KEY", ex.Message);
    }

    [Fact]
    public void Validate_ProductionVapidPublikNyckelArDenTidigareHardkodadeDevNyckeln_Kastar_UtanAttEchoaVarden()
    {
        // Den privata dev-nyckeln får inte finnas som text ens i testerna — den känns igen via SHA-256
        // i vakten. Den publika (ingen hemlighet) räcker för att bevisa att dev-paret avvisas.
        var ex = Assert.Throws<InvalidOperationException>(() => StartupSecretsGuard.Validate(
            Config(pub: StartupSecretsGuard.FormerDevVapidPublicKey),
            new FakeEnv("Production")));

        Assert.Contains("VAPID_PUBLIC_KEY", ex.Message);
        Assert.DoesNotContain(StartupSecretsGuard.FormerDevVapidPublicKey, ex.Message);
    }

    [Fact]
    public void Validate_ProductionAllaHemligheterSaknas_NamnerAllaTreVariablerIEttFel()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(null, null, null), new FakeEnv("Production")));

        Assert.Contains("JWT_SECRET", ex.Message);
        Assert.Contains("VAPID_PUBLIC_KEY", ex.Message);
        Assert.Contains("VAPID_PRIVATE_KEY", ex.Message);
    }

    [Fact]
    public void Validate_ProductionKorrektaVarden_Ok()
    {
        var ex = Record.Exception(() => StartupSecretsGuard.Validate(Config(), new FakeEnv("Production")));

        Assert.Null(ex);
    }

    [Fact]
    public void Validate_ProductionKortJwtSecret_TvingarInteMinimilangd_MenLoggarWarning()
    {
        var logger = new CapturingLogger();

        var ex = Record.Exception(() => StartupSecretsGuard.Validate(Config(jwt: "kort-hemlighet"), new FakeEnv("Production"), logger));

        Assert.Null(ex);
        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("JWT_SECRET", warning.Message);
        Assert.DoesNotContain("kort-hemlighet", warning.Message);
    }

    [Fact]
    public void Validate_ProductionLangJwtSecret_LoggarIngenWarning()
    {
        var logger = new CapturingLogger();

        StartupSecretsGuard.Validate(Config(), new FakeEnv("Production"), logger);

        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Warning);
    }

    [Theory]
    [InlineData("Staging")]
    [InlineData("Testing")]
    [InlineData("")]
    public void Validate_IckeDevelopmentBehandlasSomProduction(string envName)
    {
        Assert.Throws<InvalidOperationException>(
            () => StartupSecretsGuard.Validate(Config(null, null, null), new FakeEnv(envName)));
    }

    // --- Vakten: Development ---

    [Fact]
    public void Validate_DevelopmentMedAllaHemligheterSaknade_Ok()
    {
        var ex = Record.Exception(() => StartupSecretsGuard.Validate(Config(null, null, null), new FakeEnv("Development")));

        Assert.Null(ex);
    }

    // --- Development-fallbacks: inget privat nyckelmaterial i repot ---

    [Fact]
    public void ApplyDevelopmentFallbacks_DevelopmentUtanVapid_GenererarNyttParOchLoggarWarning()
    {
        var config = Config(pub: null, priv: null);
        var logger = new CapturingLogger();

        StartupSecretsGuard.ApplyDevelopmentFallbacks(config, new FakeEnv("Development"), logger);

        Assert.False(string.IsNullOrWhiteSpace(config["VAPID_PUBLIC_KEY"]));
        Assert.False(string.IsNullOrWhiteSpace(config["VAPID_PRIVATE_KEY"]));
        Assert.NotEqual(StartupSecretsGuard.FormerDevVapidPublicKey, config["VAPID_PUBLIC_KEY"]);
        Assert.False(StartupSecretsGuard.IsFormerDevVapidPrivateKey(config["VAPID_PRIVATE_KEY"]!));
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Warning);
        // De genererade nycklarna klarar en riktig VapidDetails (WebPush validerar längd/format).
        _ = new WebPush.VapidDetails("mailto:test@example.com", config["VAPID_PUBLIC_KEY"]!, config["VAPID_PRIVATE_KEY"]!);
    }

    [Fact]
    public void ApplyDevelopmentFallbacks_DevelopmentMedBadaNycklarSatta_RörInte()
    {
        var config = Config();

        StartupSecretsGuard.ApplyDevelopmentFallbacks(config, new FakeEnv("Development"), new CapturingLogger());

        Assert.Equal(GoodVapidPub, config["VAPID_PUBLIC_KEY"]);
        Assert.Equal(GoodVapidPriv, config["VAPID_PRIVATE_KEY"]);
    }

    [Fact]
    public void ApplyDevelopmentFallbacks_Production_GenererarAldrigNycklar()
    {
        var config = Config(pub: null, priv: null);

        StartupSecretsGuard.ApplyDevelopmentFallbacks(config, new FakeEnv("Production"));

        Assert.Null(config["VAPID_PUBLIC_KEY"]);
        Assert.Null(config["VAPID_PRIVATE_KEY"]);
    }

    [Fact]
    public void KallkodenInnehallerInteLangreDenTidigareHardkodadePrivataVapidNyckeln()
    {
        // Regressionsvakt: hasha varje 43-teckens base64url-sträng i backend-källkoden och jämför med
        // den gamla privata nyckelns hash — så att testet inte självt behöver innehålla nyckeln.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "backend")))
            dir = dir.Parent;
        Assert.NotNull(dir);

        var sep = Path.DirectorySeparatorChar;
        var offenders = Directory.EnumerateFiles(Path.Combine(dir!.FullName, "backend"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}bin{sep}"))
            .Where(f => System.Text.RegularExpressions.Regex.Matches(File.ReadAllText(f), "[A-Za-z0-9_-]{43}")
                .Any(m => StartupSecretsGuard.IsFormerDevVapidPrivateKey(m.Value)))
            .ToList();

        Assert.Empty(offenders);
    }

    [Fact]
    public void IsFormerDevVapidPrivateKey_AndraVardenAn_DenGamlaNyckeln_ArFalse()
    {
        Assert.False(StartupSecretsGuard.IsFormerDevVapidPrivateKey(GoodVapidPriv));
        Assert.False(StartupSecretsGuard.IsFormerDevVapidPrivateKey(""));
    }

    // --- Enda källa för JWT-hemligheten ---

    [Fact]
    public void JwtSettings_FromConfiguration_DevelopmentUtanSecret_AnvanderDevFallback()
    {
        var settings = JwtSettings.FromConfiguration(Config(jwt: null), new FakeEnv("Development"));

        Assert.Equal(JwtSettings.DevFallbackSecret, settings.Secret);
    }

    [Fact]
    public void JwtSettings_FromConfiguration_ProductionUtanSecret_KastarIstalletForAttFallbacka()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => JwtSettings.FromConfiguration(Config(jwt: null), new FakeEnv("Production")));

        Assert.Contains("JWT_SECRET", ex.Message);
    }

    [Fact]
    public void JwtSettings_FromConfiguration_KonfigureratVardeAnvandsOfortandratIProduction()
    {
        var settings = JwtSettings.FromConfiguration(Config(jwt: GoodJwt), new FakeEnv("Production"));

        Assert.Equal(GoodJwt, settings.Secret);
    }

    [Fact]
    public void JwtTokenService_SigneradToken_ValiderasMedParametrarnaProgramCsByggerAvSammaSettings()
    {
        var settings = new JwtSettings(GoodJwt);
        var token = new JwtTokenService(settings).GenerateAccessToken(
            new User { Email = "a@example.com", Name = "A", Role = "Admin" });

        // Exakt de parametrar Program.cs ger JwtBearer (jwtSettings.CreateValidationParameters()).
        var principal = new JwtSecurityTokenHandler { MapInboundClaims = false }
            .ValidateToken(token, settings.CreateValidationParameters(), out _);

        Assert.Equal("Admin", principal.FindFirst("role")?.Value);
    }

    [Fact]
    public void JwtTokenService_TokenSigneradMedEnAnnanHemlighet_AvvisasAvValideringen()
    {
        var token = new JwtTokenService(new JwtSettings(GoodJwt)).GenerateAccessToken(
            new User { Email = "a@example.com", Name = "A", Role = "Admin" });
        var other = new JwtSettings(GoodJwt + "-annan");

        Assert.Throws<SecurityTokenSignatureKeyNotFoundException>(() =>
            new JwtSecurityTokenHandler { MapInboundClaims = false }
                .ValidateToken(token, other.CreateValidationParameters(), out _));
    }

    [Fact]
    public void JwtTokenService_TokenSigneradMedDevFallback_AvvisasNarProductionHarEnRiktigHemlighet()
    {
        // Själva hotet: någon smider en token med den publika dev-strängen.
        var forged = new JwtTokenService(new JwtSettings(JwtSettings.DevFallbackSecret)).GenerateAccessToken(
            new User { Email = "x@example.com", Name = "X", Role = "Admin" });
        var production = new JwtSettings(GoodJwt);

        Assert.ThrowsAny<SecurityTokenException>(() =>
            new JwtSecurityTokenHandler { MapInboundClaims = false }
                .ValidateToken(forged, production.CreateValidationParameters(), out _));
    }
}
