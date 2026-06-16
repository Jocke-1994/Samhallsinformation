using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Data;
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
builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();
builder.Services.AddScoped<IIngestor, KrisinformationApiIngestor>();
builder.Services.AddScoped<IIngestor, TrafikverketApiIngestor>();

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

    // Fix Users.Id — skapas som text av SQLite-migrationen, måste vara uuid i PostgreSQL
    if (databaseUrl != null || pgHost != null)
    {
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='Users' AND column_name='Id' AND data_type='text'
              ) THEN
                ALTER TABLE ""Users"" DROP CONSTRAINT ""PK_Users"";
                ALTER TABLE ""Users"" ALTER COLUMN ""Id"" TYPE uuid USING (""Id""::uuid);
                ALTER TABLE ""Users"" ADD CONSTRAINT ""PK_Users"" PRIMARY KEY (""Id"");
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
            if (source.Category != null) existing.Category = source.Category;
        }
    }

    await db.SaveChangesAsync();

    // Rätta felaktig RSS-URL för Livsmedelsverket (gammal URL pekade på HTML-sida)
    var lmvSource = await db.Sources.FirstOrDefaultAsync(s =>
        s.Name == "Livsmedelsverket" &&
        s.Url == "https://www.livsmedelsverket.se/om-oss/press/rss/");
    if (lmvSource != null)
    {
        lmvSource.Url = "https://www.livsmedelsverket.se/rss/rss-aterkallanden/";
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
