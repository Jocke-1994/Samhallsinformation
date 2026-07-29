using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Infrastructure.Auth;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);

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

// HTTP client for ingestors
builder.Services.AddHttpClient<PolisenRssIngestor>();
builder.Services.AddHttpClient<KrisinformationApiIngestor>();
builder.Services.AddHttpClient<TrafikverketApiIngestor>();
builder.Services.AddHttpClient<SmhiApiIngestor>();
builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();
builder.Services.AddScoped<IIngestor, KrisinformationApiIngestor>();
builder.Services.AddScoped<IIngestor, TrafikverketApiIngestor>();
builder.Services.AddScoped<IIngestor, SmhiApiIngestor>();

// E-posttjänst
builder.Services.AddSingleton<IEmailService, ResendEmailService>();

// Auth
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Background service
builder.Services.AddHostedService<IngestorBackgroundService>();

// Controllers
builder.Services.AddControllers();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

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
    }
    await db.Database.MigrateAsync();

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

app.MapControllers();

app.Run();
