using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Application.Csp;
using Samhallsinformation.Application.Events;
using Samhallsinformation.Application.Faq;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Application.Push;
using Samhallsinformation.Application.RateLimiting;
using Samhallsinformation.Application.Sources;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Data;
using Samhallsinformation.Infrastructure;
using Samhallsinformation.Infrastructure.Auth;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);

// Fail-fast på hemligheter (E1#2): utanför Development startar inte appen om JWT_SECRET/VAPID-nycklar
// saknas eller är de kända dev-värdena. I Development ges dev-fallbacks (JWT-strängen, nygenererat VAPID-par).
JwtSettings jwtSettings;
using (var startupLogFactory = LoggerFactory.Create(l => l.AddSimpleConsole()))
{
    var startupLogger = startupLogFactory.CreateLogger("Startup");
    StartupSecretsGuard.Validate(builder.Configuration, builder.Environment, startupLogger);
    StartupSecretsGuard.ApplyDevelopmentFallbacks(builder.Configuration, builder.Environment, startupLogger);
    jwtSettings = JwtSettings.FromConfiguration(builder.Configuration, builder.Environment);
}

// Database — PostgreSQL på Railway (via DATABASE_URL eller PGHOST), SQLite lokalt
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var pgHost = Environment.GetEnvironmentVariable("PGHOST");
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (databaseUrl != null)
    {
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var connStr = $"Host={uri.Host};" +
                       $"Port={uri.Port};" +
                       $"Database={uri.AbsolutePath.TrimStart('/')};" +
                       $"Username={userInfo[0]};" +
                       $"Password={userInfo[1]};" +
                       "SSL Mode=Require;Trust Server Certificate=true";
        options.UseNpgsql(connStr);
    }
    else if (pgHost != null)
    {
        var connStr = $"Host={pgHost};" +
                      $"Port={Environment.GetEnvironmentVariable("PGPORT") ?? "5432"};" +
                      $"Database={Environment.GetEnvironmentVariable("PGDATABASE")};" +
                      $"Username={Environment.GetEnvironmentVariable("PGUSER")};" +
                      $"Password={Environment.GetEnvironmentVariable("PGPASSWORD")};" +
                      "SSL Mode=Require;Trust Server Certificate=true";
        options.UseNpgsql(connStr);
    }
    else
        options.UseSqlite("Data Source=samhallsinformation.db");

    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// CORS — tillåt Vercel-frontend och lokal dev
var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

// JWT-autentisering. Hemligheten läses på ETT ställe (JwtSettings) och delas med
// JwtTokenService via DI, så signering och validering alltid använder samma värde.
builder.Services.AddSingleton(jwtSettings);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Förhindrar att JsonWebTokenHandler remappar "role" till ClaimTypes.Role URI.
        // Utan detta matchar inte RoleClaimType = "role" mot [Authorize(Roles = "Admin")] → 403.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = jwtSettings.CreateValidationParameters();
    });
builder.Services.AddAuthorization();

// Rate limiting på /api/auth/* — 5 försök/minut per IP, stänger issue #295s
// sista checklistepunkt (skydd mot brute force/kontokapning).
builder.Services.AddRateLimiter(options =>
{
    // Partitionerad per IP — utan detta delar ALLA anropare samma räknare.
    options.AddPolicy("auth", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        // /64-prefix för IPv6 (V2-10) — annars roterar en angripare fritt inom sitt /64.
        partitionKey: ClientIpPartition.KeyFor(httpContext.Connection.RemoteIpAddress),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    // /api/events/search-public — byggd för kundtjänstbotens
    // "fråga om skarpa händelser"-funktion (deras issue #237, spec i
    // docs/vault/Ideer/Kundtjanstbot-handelse-sok-api.md). Anropas per
    // chattmeddelande, inte per sidladdning som övriga /api/events —
    // egen, generösare policy än auth-inloggning men INTE oskyddad som
    // resten av /api/events (som saknar rate limit helt).
    options.AddPolicy("eventssearch", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    // POST /api/support/tickets — anonym skrivning som pushar till admins (E1 #8).
    // Se SupportTicketRateLimit för tak och motivering.
    options.AddPolicy(SupportTicketRateLimit.PolicyName, SupportTicketRateLimit.GetPartition);

    // POST /api/csp-report — anonym mottagare för CSP-rapporter (V3-22), 30/min per IP.
    // Se CspReportRateLimit.
    options.AddPolicy(CspReportRateLimit.PolicyName, CspReportRateLimit.GetPartition);

    // GET /api/events/{id}/link-status — anonym, gör en utgående hämtning per anrop.
    // 30/min per IP, se LinkStatusRateLimit.
    options.AddPolicy(LinkStatusRateLimit.PolicyName, LinkStatusRateLimit.GetPartition);

    // POST /api/events/{id}/share — anonym skrivning av delningsstatistik.
    // 20/min per IP, se ShareLogRateLimit.
    options.AddPolicy(ShareLogRateLimit.PolicyName, ShareLogRateLimit.GetPartition);

    // POST /api/push/claim — anonym, anropas av service workern före varje notis.
    // 60/min per IP, se PushClaimRateLimit.
    options.AddPolicy(PushClaimRateLimit.PolicyName, PushClaimRateLimit.GetPartition);

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "För många försök. Försök igen om en liten stund." }, ct);
    };
});

// VAPID-nycklar för Web Push: kommer från env vars (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY).
// Inget nyckelmaterial finns i källkoden — i Development genereras ett nytt par vid start
// (se StartupSecretsGuard.ApplyDevelopmentFallbacks överst), utanför Development stoppar vakten uppstarten om de saknas.

// HTTP client for ingestors
builder.Services.AddHttpClient<PolisenRssIngestor>();
builder.Services.AddHttpClient<KrisinformationApiIngestor>();
builder.Services.AddHttpClient<TrafikverketApiIngestor>();
builder.Services.AddHttpClient<SmhiApiIngestor>();
builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();
builder.Services.AddScoped<IIngestor, KrisinformationApiIngestor>();
builder.Services.AddScoped<IIngestor, TrafikverketApiIngestor>();
builder.Services.AddScoped<IIngestor, SmhiApiIngestor>();

// Namngiven klient för att kolla om en källänk fortfarande lever (t.ex. en
// sparad händelses "Läs mer"-länk) — ärlig, identifierande User-Agent,
// kort timeout så ett klick aldrig hänger länge (timeout = "okänt", inte "död",
// se EventsController.GetLinkStatus).
builder.Services.AddHttpClient("linkcheck", c =>
{
    c.Timeout = TimeSpan.FromSeconds(5);
    c.DefaultRequestHeaders.TryAddWithoutValidation(
        "User-Agent", "Samhallsinformation/1.0 (+https://samhallsinformation.se; kontakt: support@samhallsinformation.se)");
});

// E-posttjänst
// Svarsadress med icke-gissningsbar token (E1#10) — nyckeln härleds ur JWT-hemligheten med egen kontext-sträng.
builder.Services.AddSingleton(new TicketReplyAddress(jwtSettings.Secret));
builder.Services.AddSingleton<IEmailService, ResendEmailService>();

// Push-notiser (Web Push/VAPID)
builder.Services.AddSingleton<IPushNotificationService, WebPushNotificationService>();

// Auth
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddScoped<IAuthService, AuthService>();
// Kontobaserad inloggningsspärr (V2-10) — processlokal räknare, måste vara singleton.
builder.Services.AddSingleton<LoginThrottle>();

// Aktivitetslogg (#491 wave 1) — behöver HttpContext för att fånga Vem/Ip/Enhet automatiskt
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAktivitetsloggService, AktivitetsloggService>();
builder.Services.AddScoped<Samhallsinformation.Application.Feed.IUserFeedService, Samhallsinformation.Application.Feed.UserFeedService>();

// CSP i rapportera-läge (V3-22, D4 alt B): mottagare för webbläsarnas överträdelserapporter.
builder.Services.AddScoped<ICspReportService, CspReportService>();

// Gemensam leverans av agentsvar (spara + mejla + logga) — delas av AdminSupportController.Reply
// och schemalagda svar (SupportScheduledActionService)
builder.Services.AddScoped<ISupportReplyDelivery, SupportReplyDelivery>();

// Övervakning och larm (V1-9): varje regel är en liten klass bakom IMonitoringRule; lägg till en ny
// regel genom att registrera den här. Trösklar från config/env, se MonitoringOptions.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(sp => MonitoringOptions.FromConfiguration(sp.GetRequiredService<IConfiguration>()));
builder.Services.AddScoped<IMonitoringRule, UsersThresholdRule>();
builder.Services.AddScoped<IMonitoringRule, SourceFailingRule>();
builder.Services.AddScoped<IMonitoringRule, PushFailuresRule>();
builder.Services.AddScoped<IMonitoringRule, CspViolationRule>();
builder.Services.AddScoped<AdminAlertCycle>();

// Background service
builder.Services.AddHostedService<IngestorBackgroundService>();
builder.Services.AddHostedService<SupportScheduledActionService>();
builder.Services.AddHostedService<UserDeletionBackgroundService>();
builder.Services.AddHostedService<ScheduledReleaseBackgroundService>();
builder.Services.AddHostedService<MonitoringService>();
builder.Services.AddHostedService<RetentionService>();

// Controllers
builder.Services.AddControllers();

var app = builder.Build();

// Railway terminerar HTTPS vid sin egen edge-proxy och vidarebefordrar
// internt — utan det här ser HttpContext.Connection.RemoteIpAddress en av
// Railways interna proxy-hopp istället för den riktiga besökarens IP,
// vilket gör per-IP-baserad rate limiting (nedan) verkningslös (bekräftat
// trasigt i produktion 2026-09-11: 10 rafflade inloggningsförsök i rad,
// ingen blockerades). Felsökt grundligt med ett tillfälligt
// diagnostikendpoint (/api/diag/ip, borttaget igen) — två separata
// missförstånd, båda hittade genom att verifiera live istället för att
// gissa:
//  1. Bara XForwardedFor efterfrågas, inte XForwardedProto — Railway
//     skickar den senare inkonsekvent (ibland alls inte, de har egna
//     X-Original-Proto/X-Original-For-headrar också). Onödigt ändå,
//     appen bryr sig bara om klient-IP:n här.
//  2. ForwardLimit måste vara null (bearbeta HELA kedjan), INTE 1.
//     Railway har TVÅ hopp, inte ett: en yttre edge OCH en intern
//     regional proxy — X-Forwarded-For innehåller kedjan "<riktig
//     klient-IP>, <Railways interna proxy-IP>". Med ForwardLimit=1
//     vecklade middleware:t bara upp DET SISTA (närmaste) hoppet i stället
//     för att fortsätta hela vägen till den riktiga klienten — bekräftat
//     genom att kapsla in middleware:t med egen loggning precis
//     före/efter och se RemoteIpAddress byta till fel värde i realtid.
// KnownIPNetworks/KnownProxies rensas medvetet — Railway exponerar ingen
// publik, stabil proxy-IP-lista att vitlista mot.
//
// VARNING: koden själv litar på HELA X-Forwarded-For-kedjan och tar det
// första (vänstra) värdet, som en klient i princip kan skriva själv. Det
// som skyddar är att Railways edge SKRIVER ÖVER klientens X-Forwarded-For
// i stället för att lägga till på den. Verifierat mot produktion
// 2026-11-23: efter 5 felaktiga inloggningar gav /api/auth/login 429 även
// med falsk X-Forwarded-For (en IP, kedja, dubbel header) och X-Real-IP.
// Det kontrolleras varje natt av .github/workflows/live-rate-limit.yml,
// som blir rött om Railway ändrar beteende eller hosting/proxy byts.
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor,
    ForwardLimit = null,
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Schema-setup och seed
await DatabaseBootstrapper.RunAsync(app);

app.MapControllers();

app.Run();
