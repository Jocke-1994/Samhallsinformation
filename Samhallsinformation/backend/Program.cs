using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Net.Http.Headers;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Infrastructure.Auth;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
// TILLFÄLLIGT (2026-09-11) — felsöker varför ForwardedHeadersMiddleware
// inte uppdaterar RemoteIpAddress i produktion trots en korrekt
// X-Forwarded-For-header. Visar middleware:ts egna debug/warning-loggar
// (t.ex. "Unknown proxy"/"Unparsable IP"/parameter-mismatch) rakt i
// Railway-konsolen. Ta bort igen när felsökningen är klar.
builder.Logging.AddFilter("Microsoft.AspNetCore.HttpOverrides", LogLevel.Debug);

// Database — PostgreSQL på Railway (via DATABASE_URL eller PGHOST), SQLite lokalt
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var pgHost      = Environment.GetEnvironmentVariable("PGHOST");
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (databaseUrl != null)
    {
        var uri      = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var connStr  = $"Host={uri.Host};" +
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

// JWT-autentisering
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "dev-secret-change-in-production-at-least-32-chars";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Förhindrar att JsonWebTokenHandler remappar "role" till ClaimTypes.Role URI.
        // Utan detta matchar inte RoleClaimType = "role" mot [Authorize(Roles = "Admin")] → 403.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer           = false,
            ValidateAudience         = false,
            RoleClaimType            = "role",
        };
    });
builder.Services.AddAuthorization();

// Rate limiting på /api/auth/* — 5 försök/minut per IP, stänger issue #295s
// sista checklistepunkt (skydd mot brute force/kontokapning).
builder.Services.AddRateLimiter(options =>
{
    // Partitionerad per IP — utan detta delar ALLA anropare samma räknare.
    options.AddPolicy("auth", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0,
        }));
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "För många försök. Försök igen om en liten stund." }, ct);
    };
});

// VAPID-nycklar för Web Push — dev-nycklar som fallback, samma mönster som
// JWT_SECRET. MÅSTE sättas som riktiga env vars i Railway för produktion.
builder.Configuration["VAPID_PUBLIC_KEY"]  ??= "BK2R_L5jWNIL18xz26s9jNiZ3wh5utgTgjjzaLUlXDcT55R2UPSm36Qn5t0LmQLbeUUoNzDsRXEFDy5qqOW7wRk";
builder.Configuration["VAPID_PRIVATE_KEY"] ??= "qyZcpirOyAymG5l8fbpPQ5hYP3UzrZglMgQ9u3gWVi0";

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
// kort timeout så ett klick aldrig hänger länge.
builder.Services.AddHttpClient("linkcheck", c =>
{
    c.Timeout = TimeSpan.FromSeconds(8);
    c.DefaultRequestHeaders.TryAddWithoutValidation(
        "User-Agent", "Samhallsinformation/1.0 (+https://samhallsinformation.se; kontakt: support@samhallsinformation.se)");
});

// E-posttjänst
builder.Services.AddSingleton<IEmailService, ResendEmailService>();

// Push-notiser (Web Push/VAPID)
builder.Services.AddSingleton<IPushNotificationService, WebPushNotificationService>();

// Auth
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Aktivitetslogg (#491 wave 1) — behöver HttpContext för att fånga Vem/Ip/Enhet automatiskt
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAktivitetsloggService, AktivitetsloggService>();

// Background service
builder.Services.AddHostedService<IngestorBackgroundService>();
builder.Services.AddHostedService<SupportScheduledActionService>();
builder.Services.AddHostedService<UserDeletionBackgroundService>();

// Controllers
builder.Services.AddControllers();

var app = builder.Build();

// Railway terminerar HTTPS vid sin egen edge-proxy och vidarebefordrar
// internt — utan det här ser HttpContext.Connection.RemoteIpAddress
// Railways interna proxy istället för den riktiga besökarens IP, vilket
// gör per-IP-baserad rate limiting (nedan) verkningslös (bekräftat trasigt
// i produktion 2026-09-11: 10 rafflade inloggningsförsök i rad, ingen
// blockerades). KnownNetworks/KnownProxies rensas medvetet — Railway
// exponerar ingen publik, stabil proxy-IP-lista att vitlista mot, och
// ForwardLimit=1 gör att bara det ALLRA sista hoppet litas på (den enda
// part som kan nå Kestrel direkt är Railways egen proxy, ingen extern
// anropare kan nå fram och spoofa X-Forwarded-For förbi den).
//
// Bara XForwardedFor efterfrågas — INTE XForwardedProto. Bekräftat via
// /api/diag/ip (2026-09-11) att Railway aldrig skickar X-Forwarded-Proto
// (de använder X-Original-Proto istället, ett icke-standardnamn).
// ForwardedHeadersOptions.RequireHeaderSymmetry är true som standard, så
// att efterfråga BÅDA fick hela vidarebefordran att tyst avbrytas — X-
// Forwarded-For hade 1 värde, X-Forwarded-Proto 0, mismatchen fick
// middleware:t att retunera utan att applicera något alls (bekräftat i
// ASP.NET Cores egen källkod, ForwardedHeadersMiddleware.cs).
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor,
    ForwardLimit     = 1,
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Schema-setup och seed
using (var scope = app.Services.CreateScope())
{
    var db        = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var ingestors = scope.ServiceProvider.GetRequiredService<IEnumerable<IIngestor>>();

    if (databaseUrl != null || pgHost != null)
    {
        bool alreadyMigrated;
        try { alreadyMigrated = (await db.Database.GetAppliedMigrationsAsync()).Any(); }
        catch { alreadyMigrated = false; }

        if (!alreadyMigrated)
        {
            // Ingen migrationshistorik → droppa och skapa fresh med MigrateAsync
            await db.Database.ExecuteSqlRawAsync(@"
                DROP TABLE IF EXISTS ""Events"";
                DROP TABLE IF EXISTS ""UserPreferences"";
                DROP TABLE IF EXISTS ""Sources"";
                DROP TABLE IF EXISTS ""__EFMigrationsHistory"";
            ");
        }
        else
        {
            // Historik finns — fixa SQLite-typade kolumner om de finns kvar från gammal migration
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='Sources' AND column_name='IsActive' AND data_type='integer'
                  ) THEN
                    ALTER TABLE ""Events""          ALTER COLUMN ""IsNational"" TYPE boolean   USING (""IsNational""::boolean);
                    ALTER TABLE ""Sources""         ALTER COLUMN ""IsActive""   TYPE boolean   USING (""IsActive""::boolean);
                    ALTER TABLE ""UserPreferences"" ALTER COLUMN ""IsActive""   TYPE boolean   USING (""IsActive""::boolean);
                    ALTER TABLE ""Events""          DROP CONSTRAINT ""PK_Events"";
                    ALTER TABLE ""Events""          ALTER COLUMN ""Id""         TYPE uuid      USING (""Id""::uuid);
                    ALTER TABLE ""Events""          ADD  CONSTRAINT ""PK_Events"" PRIMARY KEY (""Id"");
                    ALTER TABLE ""UserPreferences"" DROP CONSTRAINT ""PK_UserPreferences"";
                    ALTER TABLE ""UserPreferences"" ALTER COLUMN ""Id""         TYPE uuid      USING (""Id""::uuid);
                    ALTER TABLE ""UserPreferences"" ADD  CONSTRAINT ""PK_UserPreferences"" PRIMARY KEY (""Id"");
                    ALTER TABLE ""Events""          ALTER COLUMN ""PublishedAt"" TYPE timestamp with time zone USING (""PublishedAt""::timestamp with time zone);
                    ALTER TABLE ""Events""          ALTER COLUMN ""IngestedAt""  TYPE timestamp with time zone USING (""IngestedAt""::timestamp with time zone);
                  END IF;
                END $$;
            ");
        }

        // Säkerställ att Sources.Id har en sequence för auto-increment (saknades i SQLite-migrationen)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.sequences
                WHERE sequence_name = 'Sources_Id_seq'
              ) THEN
                CREATE SEQUENCE ""Sources_Id_seq"";
                PERFORM setval('""Sources_Id_seq""', COALESCE((SELECT MAX(""Id"") FROM ""Sources""), 0) + 1, false);
                ALTER TABLE ""Sources"" ALTER COLUMN ""Id"" SET DEFAULT nextval('""Sources_Id_seq""');
              END IF;
            END $$;
        ");

        // Konvertera Users.Id från text till uuid INNAN MigrateAsync
        // (nya tabeller skapar UserId som uuid — FK kräver att Users.Id också är uuid)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='Users' AND column_name='Id' AND data_type='text'
              ) THEN
                ALTER TABLE ""Users"" DROP CONSTRAINT IF EXISTS ""PK_Users"";
                ALTER TABLE ""Users"" ALTER COLUMN ""Id"" TYPE uuid USING (""Id""::uuid);
                ALTER TABLE ""Users"" ADD CONSTRAINT ""PK_Users"" PRIMARY KEY (""Id"");
              END IF;
            END $$;
        ");

        // EF Core använder Designer.cs-snapshot för att bestämma typer, inte Up()-metoden.
        // SQLite-genererade migrationer har HasColumnType("TEXT") för uuid/bool/timestamp.
        // Kör dessa manuellt som raw SQL med korrekta PostgreSQL-typer.
        var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToHashSet();

        if (pendingMigrations.Contains("20260630100030_AddUserSystem"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""CreatedAt"" timestamptz NOT NULL DEFAULT '0001-01-01 00:00:00+00'::timestamptz;

                CREATE TABLE IF NOT EXISTS ""NotificationDeliveryLogs"" (
                    ""Id""           uuid NOT NULL,
                    ""UserId""       uuid NOT NULL,
                    ""SourceId""     INTEGER,
                    ""Channel""      TEXT NOT NULL,
                    ""Recipient""    TEXT NOT NULL,
                    ""Subject""      TEXT NOT NULL,
                    ""Body""         TEXT NOT NULL,
                    ""Status""       TEXT NOT NULL,
                    ""ErrorMessage"" TEXT,
                    ""SentAt""       timestamptz NOT NULL,
                    CONSTRAINT ""PK_NotificationDeliveryLogs"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_NotificationDeliveryLogs_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserDevices"" (
                    ""Id""           uuid NOT NULL,
                    ""UserId""       uuid NOT NULL,
                    ""Token""        TEXT NOT NULL,
                    ""DeviceName""   TEXT NOT NULL,
                    ""Platform""     TEXT NOT NULL,
                    ""RegisteredAt"" timestamptz NOT NULL,
                    ""LastSeenAt""   timestamptz NOT NULL,
                    CONSTRAINT ""PK_UserDevices"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserDevices_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserDoNotDisturbSchedules"" (
                    ""Id""        uuid NOT NULL,
                    ""UserId""    uuid NOT NULL,
                    ""IsEnabled"" BOOLEAN NOT NULL,
                    ""StartTime"" TIME NOT NULL,
                    ""EndTime""   TIME NOT NULL,
                    CONSTRAINT ""PK_UserDoNotDisturbSchedules"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserDoNotDisturbSchedules_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserNotificationSettings"" (
                    ""Id""           uuid NOT NULL,
                    ""UserId""       uuid NOT NULL,
                    ""SourceId""     INTEGER NOT NULL,
                    ""PushEnabled""  BOOLEAN NOT NULL,
                    ""EmailEnabled"" BOOLEAN NOT NULL,
                    ""SmsEnabled""   BOOLEAN NOT NULL,
                    CONSTRAINT ""PK_UserNotificationSettings"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserNotificationSettings_Sources_SourceId""
                        FOREIGN KEY (""SourceId"") REFERENCES ""Sources"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserNotificationSettings_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserSettingAuditLogs"" (
                    ""Id""         uuid NOT NULL,
                    ""UserId""     uuid NOT NULL,
                    ""Setting""    TEXT NOT NULL,
                    ""OldValue""   TEXT,
                    ""NewValue""   TEXT,
                    ""ChangedBy""  TEXT NOT NULL,
                    ""ChangedAt""  timestamptz NOT NULL,
                    CONSTRAINT ""PK_UserSettingAuditLogs"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserSettingAuditLogs_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserSourcePreferences"" (
                    ""Id""        uuid NOT NULL,
                    ""UserId""    uuid NOT NULL,
                    ""SourceId""  INTEGER NOT NULL,
                    ""IsActive""  BOOLEAN NOT NULL,
                    ""SortOrder"" INTEGER NOT NULL,
                    CONSTRAINT ""PK_UserSourcePreferences"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserSourcePreferences_Sources_SourceId""
                        FOREIGN KEY (""SourceId"") REFERENCES ""Sources"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserSourcePreferences_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS ""IX_NotificationDeliveryLogs_SentAt""       ON ""NotificationDeliveryLogs""  (""SentAt"");
                CREATE INDEX IF NOT EXISTS ""IX_NotificationDeliveryLogs_UserId""        ON ""NotificationDeliveryLogs""  (""UserId"");
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserDevices_Token""               ON ""UserDevices""               (""Token"");
                CREATE INDEX IF NOT EXISTS ""IX_UserDevices_UserId""                     ON ""UserDevices""               (""UserId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserDoNotDisturbSchedules_UserId""       ON ""UserDoNotDisturbSchedules"" (""UserId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserNotificationSettings_SourceId""      ON ""UserNotificationSettings""  (""SourceId"");
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserNotificationSettings_UserId_SourceId""
                    ON ""UserNotificationSettings"" (""UserId"", ""SourceId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserSettingAuditLogs_ChangedAt""         ON ""UserSettingAuditLogs""      (""ChangedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_UserSettingAuditLogs_UserId""            ON ""UserSettingAuditLogs""      (""UserId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserSourcePreferences_SourceId""         ON ""UserSourcePreferences""     (""SourceId"");
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserSourcePreferences_UserId_SourceId""
                    ON ""UserSourcePreferences"" (""UserId"", ""SourceId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260630100030_AddUserSystem', '10.0.9')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260630104120_AddPasswordResetToken"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""PasswordResetTokens"" (
                    ""Id""        uuid NOT NULL,
                    ""UserId""    uuid NOT NULL,
                    ""Token""     TEXT NOT NULL,
                    ""ExpiresAt"" timestamptz NOT NULL,
                    ""UsedAt""    timestamptz,
                    CONSTRAINT ""PK_PasswordResetTokens"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_PasswordResetTokens_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PasswordResetTokens_Token""  ON ""PasswordResetTokens"" (""Token"");
                CREATE INDEX IF NOT EXISTS ""IX_PasswordResetTokens_UserId""         ON ""PasswordResetTokens"" (""UserId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260630104120_AddPasswordResetToken', '10.0.9')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260718181116_AddRefreshTokens"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""RefreshTokens"" (
                    ""Id""                  uuid NOT NULL,
                    ""UserId""              uuid NOT NULL,
                    ""TokenHash""           TEXT NOT NULL,
                    ""ExpiresAt""           timestamptz NOT NULL,
                    ""CreatedAt""           timestamptz NOT NULL,
                    ""RevokedAt""           timestamptz,
                    ""ReplacedByTokenHash"" TEXT,
                    CONSTRAINT ""PK_RefreshTokens"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_RefreshTokens_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RefreshTokens_TokenHash"" ON ""RefreshTokens"" (""TokenHash"");
                CREATE INDEX IF NOT EXISTS ""IX_RefreshTokens_UserId""           ON ""RefreshTokens"" (""UserId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260718181116_AddRefreshTokens', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260727131818_AddUserPolisenFilter"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""UserPolisenFilters"" (
                    ""UserId""         uuid NOT NULL,
                    ""KategorierJson"" TEXT,
                    ""OmradenJson""    TEXT,
                    CONSTRAINT ""PK_UserPolisenFilters"" PRIMARY KEY (""UserId""),
                    CONSTRAINT ""FK_UserPolisenFilters_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260727131818_AddUserPolisenFilter', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260727214406_AddUserSavedEvent"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""UserSavedEvents"" (
                    ""Id""      uuid NOT NULL,
                    ""UserId""  uuid NOT NULL,
                    ""EventId"" uuid NOT NULL,
                    ""SavedAt"" timestamptz NOT NULL,
                    CONSTRAINT ""PK_UserSavedEvents"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserSavedEvents_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserSavedEvents_Events_EventId""
                        FOREIGN KEY (""EventId"") REFERENCES ""Events"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserSavedEvents_UserId_EventId"" ON ""UserSavedEvents"" (""UserId"", ""EventId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260727214406_AddUserSavedEvent', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260803031558_AddPushSupport"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                DROP INDEX IF EXISTS ""IX_UserDevices_Token"";
                ALTER TABLE ""UserDevices"" DROP COLUMN IF EXISTS ""Token"";
                ALTER TABLE ""UserDevices"" ADD COLUMN IF NOT EXISTS ""Endpoint"" TEXT NOT NULL DEFAULT '';
                ALTER TABLE ""UserDevices"" ADD COLUMN IF NOT EXISTS ""P256dh""   TEXT NOT NULL DEFAULT '';
                ALTER TABLE ""UserDevices"" ADD COLUMN IF NOT EXISTS ""Auth""     TEXT NOT NULL DEFAULT '';
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserDevices_Endpoint"" ON ""UserDevices"" (""Endpoint"");

                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PushEnabled"" boolean NOT NULL DEFAULT true;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260803031558_AddPushSupport', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260803131738_AddSupportTickets"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""SupportTickets"" (
                    ""Id""               uuid NOT NULL,
                    ""TicketNumber""     integer NOT NULL,
                    ""Subject""          TEXT NOT NULL,
                    ""Category""         TEXT NOT NULL,
                    ""Status""           TEXT NOT NULL,
                    ""Channel""          TEXT NOT NULL,
                    ""CreatedByUserId""  uuid,
                    ""ContactName""      TEXT,
                    ""ContactEmail""     TEXT,
                    ""AssignedToUserId"" uuid,
                    ""ReminderAt""       timestamptz,
                    ""ReminderNote""     TEXT,
                    ""CreatedAt""        timestamptz NOT NULL,
                    ""UpdatedAt""        timestamptz NOT NULL,
                    CONSTRAINT ""PK_SupportTickets"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_SupportTickets_Users_CreatedByUserId""
                        FOREIGN KEY (""CreatedByUserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_SupportTickets_Users_AssignedToUserId""
                        FOREIGN KEY (""AssignedToUserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""SupportTicketMessages"" (
                    ""Id""           uuid NOT NULL,
                    ""TicketId""     uuid NOT NULL,
                    ""SenderType""   TEXT NOT NULL,
                    ""AuthorUserId"" uuid,
                    ""Text""         TEXT NOT NULL,
                    ""IsInternal""   boolean NOT NULL,
                    ""CreatedAt""    timestamptz NOT NULL,
                    CONSTRAINT ""PK_SupportTicketMessages"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_SupportTicketMessages_SupportTickets_TicketId""
                        FOREIGN KEY (""TicketId"") REFERENCES ""SupportTickets"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_SupportTicketMessages_Users_AuthorUserId""
                        FOREIGN KEY (""AuthorUserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""SupportTicketScheduledActions"" (
                    ""Id""               uuid NOT NULL,
                    ""TicketId""         uuid NOT NULL,
                    ""Type""             TEXT NOT NULL,
                    ""ScheduledAt""      timestamptz NOT NULL,
                    ""CreatedByUserId""  uuid NOT NULL,
                    ""Text""             TEXT,
                    ""ReassignToUserId"" uuid,
                    ""Instruction""      TEXT,
                    ""Executed""         boolean NOT NULL,
                    ""ExecutedAt""       timestamptz,
                    CONSTRAINT ""PK_SupportTicketScheduledActions"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_SupportTicketScheduledActions_SupportTickets_TicketId""
                        FOREIGN KEY (""TicketId"") REFERENCES ""SupportTickets"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_SupportTicketScheduledActions_Users_CreatedByUserId""
                        FOREIGN KEY (""CreatedByUserId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_SupportTicketScheduledActions_Users_ReassignToUserId""
                        FOREIGN KEY (""ReassignToUserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SupportTickets_TicketNumber""              ON ""SupportTickets""              (""TicketNumber"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTickets_CreatedByUserId""            ON ""SupportTickets""              (""CreatedByUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTickets_AssignedToUserId""           ON ""SupportTickets""              (""AssignedToUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTickets_Status""                     ON ""SupportTickets""              (""Status"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketMessages_TicketId""             ON ""SupportTicketMessages""       (""TicketId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketMessages_AuthorUserId""         ON ""SupportTicketMessages""       (""AuthorUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketScheduledActions_TicketId""     ON ""SupportTicketScheduledActions"" (""TicketId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketScheduledActions_CreatedByUserId"" ON ""SupportTicketScheduledActions"" (""CreatedByUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketScheduledActions_ReassignToUserId"" ON ""SupportTicketScheduledActions"" (""ReassignToUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_SupportTicketScheduledActions_Executed_ScheduledAt"" ON ""SupportTicketScheduledActions"" (""Executed"", ""ScheduledAt"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260803131738_AddSupportTickets', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804145629_AddFeatureIdeas"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""FeatureIdeas"" (
                    ""Id""               uuid NOT NULL,
                    ""IdeaNumber""       integer NOT NULL,
                    ""Title""            TEXT NOT NULL,
                    ""Description""      TEXT NOT NULL,
                    ""Stage""            TEXT NOT NULL,
                    ""TriageKanGoras""   boolean,
                    ""TriageBorGoras""   boolean,
                    ""TriageMotivering"" TEXT,
                    ""KällaTyp""         TEXT NOT NULL,
                    ""SourceTicketId""   uuid,
                    ""FlagKey""          TEXT,
                    ""CreatedByUserId""  uuid NOT NULL,
                    ""CreatedAt""        timestamptz NOT NULL,
                    ""UpdatedAt""        timestamptz NOT NULL,
                    CONSTRAINT ""PK_FeatureIdeas"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_FeatureIdeas_SupportTickets_SourceTicketId""
                        FOREIGN KEY (""SourceTicketId"") REFERENCES ""SupportTickets"" (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_FeatureIdeas_Users_CreatedByUserId""
                        FOREIGN KEY (""CreatedByUserId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""FeatureIdeaChecklistItems"" (
                    ""Id""            uuid NOT NULL,
                    ""FeatureIdeaId"" uuid NOT NULL,
                    ""Label""         TEXT NOT NULL,
                    ""Done""          boolean NOT NULL,
                    ""DoneAt""        timestamptz,
                    ""DoneByUserId""  uuid,
                    CONSTRAINT ""PK_FeatureIdeaChecklistItems"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_FeatureIdeaChecklistItems_FeatureIdeas_FeatureIdeaId""
                        FOREIGN KEY (""FeatureIdeaId"") REFERENCES ""FeatureIdeas"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_FeatureIdeaChecklistItems_Users_DoneByUserId""
                        FOREIGN KEY (""DoneByUserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""FeatureIdeaTesters"" (
                    ""Id""            uuid NOT NULL,
                    ""FeatureIdeaId"" uuid NOT NULL,
                    ""UserId""        uuid NOT NULL,
                    ""AddedAt""       timestamptz NOT NULL,
                    CONSTRAINT ""PK_FeatureIdeaTesters"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_FeatureIdeaTesters_FeatureIdeas_FeatureIdeaId""
                        FOREIGN KEY (""FeatureIdeaId"") REFERENCES ""FeatureIdeas"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_FeatureIdeaTesters_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_FeatureIdeas_IdeaNumber""                        ON ""FeatureIdeas""               (""IdeaNumber"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeas_Stage""                             ON ""FeatureIdeas""               (""Stage"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeas_SourceTicketId""                    ON ""FeatureIdeas""               (""SourceTicketId"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeas_CreatedByUserId""                   ON ""FeatureIdeas""               (""CreatedByUserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeaChecklistItems_FeatureIdeaId""        ON ""FeatureIdeaChecklistItems""  (""FeatureIdeaId"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeaChecklistItems_DoneByUserId""         ON ""FeatureIdeaChecklistItems""  (""DoneByUserId"");
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_FeatureIdeaTesters_FeatureIdeaId_UserId""         ON ""FeatureIdeaTesters""         (""FeatureIdeaId"", ""UserId"");
                CREATE INDEX IF NOT EXISTS        ""IX_FeatureIdeaTesters_UserId""                      ON ""FeatureIdeaTesters""         (""UserId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804145629_AddFeatureIdeas', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804192019_AddEmailVerification"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailVerified"" boolean NOT NULL DEFAULT false;

                CREATE TABLE IF NOT EXISTS ""EmailVerificationTokens"" (
                    ""Id""        uuid NOT NULL,
                    ""UserId""    uuid NOT NULL,
                    ""Token""     TEXT NOT NULL,
                    ""ExpiresAt"" timestamptz NOT NULL,
                    ""UsedAt""    timestamptz,
                    CONSTRAINT ""PK_EmailVerificationTokens"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_EmailVerificationTokens_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_EmailVerificationTokens_Token""  ON ""EmailVerificationTokens"" (""Token"");
                CREATE INDEX IF NOT EXISTS        ""IX_EmailVerificationTokens_UserId"" ON ""EmailVerificationTokens"" (""UserId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804192019_AddEmailVerification', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804205026_AddAccountControlFields"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""AuthProvider""     TEXT NOT NULL DEFAULT 'local';
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""IsActive""         boolean NOT NULL DEFAULT true;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspendedAt""      timestamptz;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspendedReason""  TEXT;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""TermsAcceptedAt""  timestamptz;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804205026_AddAccountControlFields', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804220533_AddSuspensionReminder"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspensionReminderAt""   timestamptz;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspensionReminderNote"" TEXT;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804220533_AddSuspensionReminder', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804221437_AddUserDeletedAt"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""DeletedAt"" timestamptz;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804221437_AddUserDeletedAt', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260804222722_AddDeletionScheduledAt"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""DeletionScheduledAt"" timestamptz;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260804222722_AddDeletionScheduledAt', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260805001023_AddUserDisplayName"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""DisplayName"" TEXT;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260805001023_AddUserDisplayName', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260814210603_AddTicketArchiveAndReadTracking"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""SupportTickets"" ADD COLUMN IF NOT EXISTS ""IsArchived""     boolean NOT NULL DEFAULT false;
                ALTER TABLE ""SupportTickets"" ADD COLUMN IF NOT EXISTS ""FirstOpenedAt""  timestamptz;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260814210603_AddTicketArchiveAndReadTracking', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260816194200_AddPushNotifKategorier"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PushNyaHandelser"" boolean NOT NULL DEFAULT true;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PushNyVersion""    boolean NOT NULL DEFAULT true;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260816194200_AddPushNotifKategorier', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260817092731_AddIngestorRunLog"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""IngestorRunLogs"" (
                    ""Id""             uuid NOT NULL,
                    ""SourceId""       integer NOT NULL,
                    ""RunAt""          timestamptz NOT NULL,
                    ""Success""        boolean NOT NULL,
                    ""EventsInserted"" integer NOT NULL,
                    ""ErrorMessage""   text,
                    CONSTRAINT ""PK_IngestorRunLogs"" PRIMARY KEY (""Id"")
                );

                CREATE INDEX IF NOT EXISTS ""IX_IngestorRunLogs_RunAt""    ON ""IngestorRunLogs"" (""RunAt"");
                CREATE INDEX IF NOT EXISTS ""IX_IngestorRunLogs_SourceId"" ON ""IngestorRunLogs"" (""SourceId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260817092731_AddIngestorRunLog', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260819114837_AddAdminActivityLog"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""AdminActivityLogs"" (
                    ""Id""               uuid NOT NULL,
                    ""Tid""              timestamptz NOT NULL,
                    ""Vem""              text NOT NULL,
                    ""Typ""              text NOT NULL,
                    ""Rubrik""           text NOT NULL,
                    ""Detalj""           text NOT NULL,
                    ""Ångrad""           boolean NOT NULL,
                    ""AngraAnvandareId"" text,
                    ""AngraEventId""     text,
                    ""AngraTitle""       text,
                    ""AngraSourceName""  text,
                    ""AngraPublishedAt"" text,
                    ""AngraSparadDatum"" text,
                    ""AngraUndoAction""  text,
                    CONSTRAINT ""PK_AdminActivityLogs"" PRIMARY KEY (""Id"")
                );

                CREATE INDEX IF NOT EXISTS ""IX_AdminActivityLogs_Tid"" ON ""AdminActivityLogs"" (""Tid"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260819114837_AddAdminActivityLog', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260819113722_AddFeatureFlagOverrides"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""FeatureFlagOverrides"" (
                    ""Key""   text NOT NULL,
                    ""Value"" boolean NOT NULL,
                    CONSTRAINT ""PK_FeatureFlagOverrides"" PRIMARY KEY (""Key"")
                );

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260819113722_AddFeatureFlagOverrides', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260819112808_AddFaqItems"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""FaqItems"" (
                    ""Id""         uuid NOT NULL,
                    ""Kategori""   text NOT NULL,
                    ""Publicerad"" boolean NOT NULL,
                    ""Fraga""      text NOT NULL,
                    ""Svar""       text NOT NULL,
                    ""CreatedAt""  timestamptz NOT NULL,
                    CONSTRAINT ""PK_FaqItems"" PRIMARY KEY (""Id"")
                );

                CREATE INDEX IF NOT EXISTS ""IX_FaqItems_Kategori"" ON ""FaqItems"" (""Kategori"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260819112808_AddFaqItems', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Ny tabell (inte ALTER TABLE ADD COLUMN på befintlig data) — skapas
        // direkt med korrekta PostgreSQL-typer i CREATE TABLE, samma mönster
        // som AddSupportTickets. Ingen självläkande DO-block behövs eftersom
        // tabellen är tom/ny — om det här blocket ändå missas vid ett
        // fresh-deploy blir felet identiskt med AddPushNotifKategorier-
        // incidenten (df95da1) och löses på samma sätt i efterhand.
        if (pendingMigrations.Contains("20260819035005_AddSiteSettings"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""SiteSettings"" (
                    ""Id"" integer PRIMARY KEY,
                    ""ShowLoginButton"" boolean NOT NULL DEFAULT true,
                    ""ShowRegisterButton"" boolean NOT NULL DEFAULT true
                );

                INSERT INTO ""SiteSettings"" (""Id"", ""ShowLoginButton"", ""ShowRegisterButton"")
                VALUES (1, true, true)
                ON CONFLICT (""Id"") DO NOTHING;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260819035005_AddSiteSettings', '10.0.10')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Ersätter UserPolisenFilters (en rad per användare) med PolisenBevakningar
        // (flera rader per användare, ELLER-kombinerade — se PolisenBevakningMatcher).
        // Ny tabell skapas med korrekta PostgreSQL-typer, precis som AddSupportTickets/
        // AddSiteSettings. Datamigrering i samma block, INNAN gamla tabellen droppas:
        // en rad i UserPolisenFilters med ett faktiskt anpassat filter (minst ett
        // fält inte null) blir en motsvarande bevakning, så en testares/adminens
        // redan sparade filter inte tappas bort.
        if (pendingMigrations.Contains("20260819192204_AddPolisenBevakningar"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""PolisenBevakningar"" (
                    ""Id""             uuid NOT NULL,
                    ""UserId""         uuid NOT NULL,
                    ""KategorierJson"" TEXT,
                    ""OmradenJson""    TEXT,
                    ""CreatedAt""      timestamptz NOT NULL,
                    CONSTRAINT ""PK_PolisenBevakningar"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_PolisenBevakningar_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS ""IX_PolisenBevakningar_UserId"" ON ""PolisenBevakningar"" (""UserId"");

                INSERT INTO ""PolisenBevakningar"" (""Id"", ""UserId"", ""KategorierJson"", ""OmradenJson"", ""CreatedAt"")
                SELECT gen_random_uuid(), ""UserId"", ""KategorierJson"", ""OmradenJson"", now()
                FROM ""UserPolisenFilters""
                WHERE ""KategorierJson"" IS NOT NULL OR ""OmradenJson"" IS NOT NULL;

                DROP TABLE IF EXISTS ""UserPolisenFilters"";

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260819192204_AddPolisenBevakningar', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Flera samtidigt aktiva driftmeddelanden (olika målgrupper) — en
        // riktig rad-per-meddelande-tabell, inte fler fält på SiteSettings-
        // singletonen (som bara kan uttrycka ETT meddelande i taget).
        if (pendingMigrations.Contains("20260820072659_AddMaintenanceBanners"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""MaintenanceBanners"" (
                    ""Id""        uuid NOT NULL,
                    ""Message""   text NOT NULL,
                    ""StartUtc""  timestamptz NOT NULL,
                    ""EndUtc""    timestamptz NOT NULL,
                    ""Audience""  text NOT NULL,
                    ""CreatedAt"" timestamptz NOT NULL,
                    CONSTRAINT ""PK_MaintenanceBanners"" PRIMARY KEY (""Id"")
                );

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260820072659_AddMaintenanceBanners', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Breddar AdminActivityLogs till den generella aktivitetsloggen
        // (#491 wave 1) — se Application/Aktivitetslogg/AktivitetsloggService.
        // Befintliga rader backfillas AktörTyp='Admin' (de är alla
        // Kontoåtgärd/Sparat-ångra, admin/support-initierade).
        if (pendingMigrations.Contains("20260822101606_AddAktivitetsloggFields"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""AktörTyp""     text NOT NULL DEFAULT 'Admin';
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""Arkiverad""    boolean NOT NULL DEFAULT false;
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""Test""         boolean NOT NULL DEFAULT false;
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""Ip""           text;
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""Enhet""        text;
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""GammaltVärde"" text;
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""NyttVärde""    text;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260822101606_AddAktivitetsloggFields', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // E-postbyte kräver nu en bekräftelselänk till den NYA adressen innan
        // kontots e-post faktiskt ändras — se AuthController.RequestEmailChange.
        if (pendingMigrations.Contains("20260827083220_AddEmailChangeToken"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""EmailChangeTokens"" (
                    ""Id""        uuid NOT NULL,
                    ""UserId""    uuid NOT NULL,
                    ""NewEmail""  TEXT NOT NULL,
                    ""Token""     TEXT NOT NULL,
                    ""ExpiresAt"" timestamptz NOT NULL,
                    ""UsedAt""    timestamptz,
                    CONSTRAINT ""PK_EmailChangeTokens"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_EmailChangeTokens_Users_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_EmailChangeTokens_Token""  ON ""EmailChangeTokens"" (""Token"");
                CREATE INDEX IF NOT EXISTS        ""IX_EmailChangeTokens_UserId"" ON ""EmailChangeTokens"" (""UserId"");

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260827083220_AddEmailChangeToken', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Länkar en Ärende-typad aktivitetsloggrad till sitt SupportTicket, så
        // Aktivitetslogg/Översikt kan länka direkt till ärendet istället för
        // att bara nämna det i text.
        if (pendingMigrations.Contains("20260901092420_AddAdminActivityLogRelateratArendeId"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""AdminActivityLogs"" ADD COLUMN IF NOT EXISTS ""RelateratÄrendeId"" uuid;

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260901092420_AddAdminActivityLogRelateratArendeId', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        // Oläst-markeringen (FirstOpenedAt) återställdes aldrig efter första
        // öppningen, så ett nytt svar på ett redan öppnat ärende gav ingen
        // "gul plupp" igen. LastViewedAt uppdateras vid VARJE öppning,
        // LastUserMessageAt vid varje medborgar-meddelande (skapelse, svar,
        // Resend inbound) — oläst = LastUserMessageAt > LastViewedAt.
        // Backfill: LastViewedAt = FirstOpenedAt (redan öppnade ärenden utan
        // nyare svar förblir lästa), LastUserMessageAt = senaste user-raden.
        if (pendingMigrations.Contains("20260904230047_AddTicketLastViewedAndLastUserMessage"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""SupportTickets"" ADD COLUMN IF NOT EXISTS ""LastViewedAt""      timestamptz;
                ALTER TABLE ""SupportTickets"" ADD COLUMN IF NOT EXISTS ""LastUserMessageAt"" timestamptz;

                UPDATE ""SupportTickets"" SET ""LastViewedAt"" = ""FirstOpenedAt"" WHERE ""FirstOpenedAt"" IS NOT NULL;

                UPDATE ""SupportTickets"" st SET ""LastUserMessageAt"" = (
                    SELECT MAX(m.""CreatedAt"") FROM ""SupportTicketMessages"" m
                    WHERE m.""TicketId"" = st.""Id"" AND m.""SenderType"" = 'user'
                );

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260904230047_AddTicketLastViewedAndLastUserMessage', '10.0.11')
                ON CONFLICT DO NOTHING;
            ");
        }

        if (pendingMigrations.Contains("20260911113746_AddPushDispatchClaims"))
        {
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""PushDispatchClaims"" (
                    ""Id""                uuid NOT NULL,
                    ""UserId""            uuid NOT NULL,
                    ""ClaimedByDeviceId"" uuid,
                    ""ClaimedAt""         timestamptz,
                    ""CreatedAt""         timestamptz NOT NULL,
                    CONSTRAINT ""PK_PushDispatchClaims"" PRIMARY KEY (""Id"")
                );

                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20260911113746_AddPushDispatchClaims', '10.0.12')
                ON CONFLICT DO NOTHING;
            ");
        }
    }
    await db.Database.MigrateAsync();

    // Fix Users.PushNyaHandelser/PushNyVersion — det första deployet av
    // AddPushNotifKategorier gick via ren MigrateAsync() (glömde lägga till
    // ovanstående pendingMigrations-block innan merge) och skapade kolumnerna
    // som integer istället för boolean, vilket kraschade EF-läsning av VARJE
    // User-rad (inkl. inloggning) med "Reading as System.Boolean is not
    // supported for fields having DataTypeName integer". Samma självläkande
    // mönster som IsPublished-fixen nedan.
    if (databaseUrl != null || pgHost != null)
    {
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='Users' AND column_name='PushNyaHandelser' AND data_type='integer'
              ) THEN
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyaHandelser"" DROP DEFAULT;
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyaHandelser"" TYPE boolean USING (""PushNyaHandelser""::boolean);
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyaHandelser"" SET DEFAULT true;
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyVersion""    DROP DEFAULT;
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyVersion""    TYPE boolean USING (""PushNyVersion""::boolean);
                ALTER TABLE ""Users"" ALTER COLUMN ""PushNyVersion""    SET DEFAULT true;
              END IF;
            END $$;
        ");
    }

    // Normalisera AdminActivityLogs.Typ för gamla Sparat-rader (#491 wave 1):
    // skrevs tidigare som "Sparat: tillagd"/"Sparat: borttagen" (se Anvandare.tsx/
    // Handelsesok.tsx), men det nya enhetliga Typ-filtret i Aktivitetslogg
    // förväntar sig "Kontoåtgärd" (Rubrik-texten beskriver redan tillagd/
    // borttagen, ingen information går förlorad). Ren datauppdatering, inte
    // schemaändring — idempotent (inga rader matchar längre efter första
    // körningen), samma provider för både SQLite och PostgreSQL.
    await db.Database.ExecuteSqlRawAsync(@"
        UPDATE ""AdminActivityLogs"" SET ""Typ"" = 'Kontoåtgärd'
        WHERE ""Typ"" IN ('Sparat: tillagd', 'Sparat: borttagen');
    ");

    // Fix Sources.IsPublished — SQLite-migration skapar den som INTEGER, PostgreSQL behöver boolean
    if (databaseUrl != null || pgHost != null)
    {
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='Sources' AND column_name='IsPublished' AND data_type='integer'
              ) THEN
                ALTER TABLE ""Sources"" ALTER COLUMN ""IsPublished"" DROP DEFAULT;
                ALTER TABLE ""Sources"" ALTER COLUMN ""IsPublished"" TYPE boolean USING (""IsPublished""::boolean);
                ALTER TABLE ""Sources"" ALTER COLUMN ""IsPublished"" SET DEFAULT true;
              END IF;
            END $$;
        ");
    }

    // Fix Sources.LastFetchedAt — SQLite-migration skapar TEXT, PostgreSQL behöver timestamp with time zone
    if (databaseUrl != null || pgHost != null)
    {
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='Sources' AND column_name='LastFetchedAt' AND data_type='text'
              ) THEN
                ALTER TABLE ""Sources"" ALTER COLUMN ""LastFetchedAt""
                  TYPE timestamp with time zone
                  USING (""LastFetchedAt""::timestamp with time zone);
              END IF;
            END $$;
        ");
    }

    foreach (var ingestor in ingestors)
    {
        var source = ingestor.Source;
        var existing = db.Sources.Find(source.Id);
        if (existing == null)
            db.Sources.Add(source);
        else
        {
            existing.Name      = source.Name;
            existing.ShortName = source.ShortName;
            existing.BaseUrl   = source.BaseUrl;
            existing.Type      = source.Type;
            existing.Url       = source.Url;
            // IsPublished uppdateras INTE — admin-ändringar ska överleva restarts
            if (source.Category != null) existing.Category = source.Category;
        }
    }

    await db.SaveChangesAsync();

    // Seed SMHI Nyheter — RSS-komplement till SmhiApiIngestor (varningar)
    if (!db.Sources.Any(s => s.Url == "https://www.smhi.se/rss/nyheter-fran-smhi"))
    {
        db.Sources.Add(new Source
        {
            Name        = "SMHI Nyheter",
            ShortName   = "SMHI",
            BaseUrl     = "https://www.smhi.se",
            Url         = "https://www.smhi.se/rss/nyheter-fran-smhi",
            Category    = "Väder",
            Type        = SourceType.RSS,
            IsActive    = true,
            IsPublished = false,
        });
        await db.SaveChangesAsync();
    }

    // Seed Polisen Efterlysningar — RSS-komplement till PolisenRssIngestor
    // (händelser). Vittnesmål/efterlysningar/försvunna personer, inte bara ett
    // filtrerat delmängd av händelseflödet. Samma ShortName ("Polisen") grupperar
    // den under samma sidebar-knapp (multi-feed-mönstret från session 15).
    // IsPublished=false tills flödet är verifierat att faktiskt leverera data.
    if (!db.Sources.Any(s => s.Url == "https://polisen.se/aktuellt/rss/hela-landet/hjalp-polisen-rss/"))
    {
        db.Sources.Add(new Source
        {
            Name        = "Polisen Efterlysningar",
            ShortName   = "Polisen",
            BaseUrl     = "https://polisen.se",
            Url         = "https://polisen.se/aktuellt/rss/hela-landet/hjalp-polisen-rss/",
            Category    = "Nationell",
            Type        = SourceType.RSS,
            IsActive    = true,
            IsPublished = false,
        });
        await db.SaveChangesAsync();
    }

    // Rätta felaktiga RSS-URL:er (gamla URL:er pekade på HTML-sidor)
    var lmvSource = await db.Sources.FirstOrDefaultAsync(s =>
        s.Name == "Livsmedelsverket" &&
        s.Url == "https://www.livsmedelsverket.se/om-oss/press/rss/");
    if (lmvSource != null)
    {
        lmvSource.Url = "https://www.livsmedelsverket.se/rss/rss-aterkallanden/";
        await db.SaveChangesAsync();
    }

    var lkvSource = await db.Sources.FirstOrDefaultAsync(s =>
        s.Name == "Läkemedelsverket" &&
        s.Url == "https://www.lakemedelsverket.se/sv/om-lakemedelsverket/press-och-nyheter/rss");
    if (lkvSource != null)
    {
        lkvSource.Url = "https://www.lakemedelsverket.se/api/newslist/newsrss?query=&pageTypeId=&from=&to=";
        await db.SaveChangesAsync();
    }

    // Rätta KEMI ShortName: sattes till "KEMI" vid aktivering via admin
    var kemiSource = await db.Sources.FirstOrDefaultAsync(s => s.ShortName == "KEMI");
    if (kemiSource != null)
    {
        kemiSource.ShortName = "Kemikalieinspektionen";
        await db.SaveChangesAsync();
    }

    // Seed FAQ — bara vid tomt bord, admin äger innehållet därefter (samma
    // startvärden som tidigare låg i frontendens faqStorage.ts).
    if (!db.FaqItems.Any())
    {
        db.FaqItems.AddRange(
            new FaqItem { Kategori = "Konto",         Publicerad = false, Fraga = "Varför fick jag ingen push-notis?",                 Svar = "Kontrollera att push-notiser är aktiverat under Konto → Push-notiser, och att kategorin Ny händelse är påslagen. Se också till att källan finns under Mina källor, och att din webbläsare/enhet tillåter notiser från sidan." },
            new FaqItem { Kategori = "Konto",         Publicerad = false, Fraga = "Hur aktiverar jag push-notiser?",                    Svar = "Gå till Konto → Push-notiser och slå på Ny händelse för att få en notis när dina källor i Mitt flöde publicerar något nytt. Ingen separat \"aktivera push\"-knapp behövs — att slå på kategorin startar prenumerationen automatiskt." },
            new FaqItem { Kategori = "Konto",         Publicerad = false, Fraga = "Kan jag pausa notiser tillfälligt?",                 Svar = "Ja, stäng av Ny händelse under Konto → Push-notiser. Webbläsarens push-prenumeration avslutas automatiskt, och startas om nästa gång du slår på den igen." },
            new FaqItem { Kategori = "Mina källor",   Publicerad = true,  Fraga = "Hur lägger jag till fler källor?",                   Svar = "Gå till Mina källor i profilmenyn. Där kan du söka efter och lägga till de myndigheter som finns tillgängliga." },
            new FaqItem { Kategori = "Mina källor",   Publicerad = true,  Fraga = "Kan jag följa flera myndigheter samtidigt?",         Svar = "Ja, du kan lägga till hur många källor du vill i Mina källor. Alla visas i ditt nyhetsflöde." },
            new FaqItem { Kategori = "Konto",         Publicerad = false, Fraga = "Hur tar jag bort mitt konto?",                       Svar = "Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras." },
            new FaqItem { Kategori = "Konto",         Publicerad = false, Fraga = "Hur laddar jag ner min data?",                       Svar = "Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20)." },
            new FaqItem { Kategori = "Uppdateringar", Publicerad = false, Fraga = "Hur ser jag vad som är nytt i senaste versionen?",   Svar = "Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar sedan förra uppdateringen." },
            new FaqItem { Kategori = "Uppdateringar", Publicerad = true,  Fraga = "Hur rapporterar jag ett fel?",                       Svar = "Klicka på Feedback-knappen längst ner i sidomenyn och beskriv vad som hänt. Meddelandet skickas till oss, och du kan ange din e-post om du vill ha svar." }
        );
        await db.SaveChangesAsync();
    }

    // Kompletterande FAQ-frågor inför öppen registrering (session 43) — tabellen
    // har redan rader sedan tidigare, så varje fråga läggs till enskilt och
    // idempotent (kollar på frågetexten) istället för villkoret ovan. Bara
    // funktioner som faktiskt är påslagna i produktion nämns — push-notiser,
    // Polisen-bevakningar, radera konto/GDPR-export och tvåfaktor ligger
    // fortfarande bakom avstängda flaggor och beskrivs medvetet inte.
    var nyaFaqFragor = new[]
    {
        new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_losenord", Fraga = "Hur byter jag lösenord?",
            Svar = "Gå till Konto → Lösenordsbyte, ange ditt nuvarande lösenord och sedan det nya. Har du skapat kontot med Google finns inget lösenord att byta — logga in via Google-knappen istället." },
        new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_info", Fraga = "Hur ändrar jag min e-postadress eller mitt namn?",
            Svar = "Gå till Konto → Kontoinformation. Ändrar du e-postadress skickar vi en bekräftelselänk till den nya adressen — bytet gäller först när du klickat på länken, och du loggas ut ur eventuella andra inloggade enheter av säkerhetsskäl." },
        new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = null, Fraga = "Kan jag logga in med Google?",
            Svar = "Ja. Välj \"Fortsätt med Google\" på inloggnings- eller registreringssidan — det fungerar både för att skapa ett nytt konto och för att logga in på ett befintligt." },
        new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_epost_paminnelse", Fraga = "Varför ber ni mig bekräfta min e-postadress?",
            Svar = "En banderoll påminner dig om att klicka på bekräftelselänken vi skickade när du registrerade dig. Det bevisar att adressen faktiskt är din — du kan fortsätta använda tjänsten som vanligt under tiden, inget låses." },
        new FaqItem { Kategori = "Mina källor", Publicerad = true, FlagKey = "kallor_alla", Fraga = "Vad är skillnaden på Alla källor och Mina källor?",
            Svar = "Mina källor visar de myndigheter du redan följer och som syns i ditt flöde. Alla källor är den fullständiga listan att välja bland — där lägger du till fler." },
        new FaqItem { Kategori = "Uppdateringar", Publicerad = true, FlagKey = null, Fraga = "Var ser jag vad som är nytt i tjänsten?",
            Svar = "Klicka på Nyheter i sidomenyn om du är utloggad, eller Uppdateringar i profilmenyn om du är inloggad, för en lista över de senaste ändringarna." },
    };
    foreach (var fraga in nyaFaqFragor)
    {
        if (!db.FaqItems.Any(f => f.Fraga == fraga.Fraga))
        {
            db.FaqItems.Add(fraga);
        }
    }
    await db.SaveChangesAsync();

    // Seed admin-användare från env-variabler
    var adminEmail    = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
    var adminName     = Environment.GetEnvironmentVariable("ADMIN_NAME") ?? "Joakim Rehn";

    if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword))
    {
        if (!db.Users.Any(u => u.Email == adminEmail))
        {
            var hasher = new PasswordHasher<User>();
            var admin  = new User
            {
                Email        = adminEmail,
                Name         = adminName,
                Role         = "Admin",
                PasswordHash = hasher.HashPassword(null!, adminPassword),
            };
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        }
    }
}

// TILLFÄLLIG diagnostik (2026-09-11) för att felsöka varför rate limiting
// (5/min/IP) inte triggar i produktion — visar exakt vad backend ser för
// klient-IP och rå X-Forwarded-For-header. Ta bort igen när felsökningen
// är klar.
app.MapGet("/api/diag/ip", (HttpContext ctx) =>
{
    var rawXff = ctx.Request.Headers["X-Forwarded-For"].ToString();
    var parseOk = System.Net.IPEndPoint.TryParse(rawXff, out var parsedEndpoint);
    var bareIpParseOk = System.Net.IPAddress.TryParse(rawXff, out var parsedAddress);
    // Exakt samma anrop som ForwardedHeadersMiddleware använder internt
    // (Microsoft.Net.Http.Headers-extensionen, inte en enkel .ToString())
    // — X-Forwarded-For fanns KVAR oförändrad i headerlistan trots att
    // middleware:t borde ha tagit bort den efter att ha konsumerat den,
    // vilket bevisar att applyChanges aldrig blev sant där. Det här
    // visar om det är just den här läsvägen som skiljer sig.
    var commaSeparated = ctx.Request.Headers.GetCommaSeparatedValues("X-Forwarded-For");

    return Results.Ok(new
    {
        // Versionsmarkör + processens starttid — för att entydigt bevisa om det
        // verkligen är den senaste koden som kör, oavsett vad Railways UI säger.
        diagVersion         = "v5-2026-09-11-2140",
        processStartTimeUtc = System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("o"),
        remoteIpAddress = ctx.Connection.RemoteIpAddress?.ToString(),
        remotePort      = ctx.Connection.RemotePort,
        requestScheme   = ctx.Request.Scheme,
        xForwardedFor    = rawXff,
        xForwardedForLength = rawXff.Length,
        xForwardedForBytes  = System.Text.Encoding.UTF8.GetBytes(rawXff),
        ipEndPointTryParseOk = parseOk,
        ipEndPointParsedValue = parsedEndpoint?.ToString(),
        ipAddressTryParseOk   = bareIpParseOk,
        ipAddressParsedValue  = parsedAddress?.ToString(),
        commaSeparatedValues  = commaSeparated,
        commaSeparatedCount   = commaSeparated.Length,
        xForwardedProto  = ctx.Request.Headers["X-Forwarded-Proto"].ToString(),
        // .Select istället för .ToDictionary — en dubblerad header-nyckel (t.ex.
        // flera X-Forwarded-For-rader genom flera proxy-hopp) hade fått
        // ToDictionary att kasta ArgumentException.
        allHeaders = ctx.Request.Headers.Select(h => $"{h.Key}: {h.Value}").ToList(),
    });
});

app.MapControllers();

app.Run();
