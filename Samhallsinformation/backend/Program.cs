using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
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

// HTTP client for ingestors
builder.Services.AddHttpClient<PolisenRssIngestor>();
builder.Services.AddHttpClient<KrisinformationApiIngestor>();
builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();
builder.Services.AddScoped<IIngestor, KrisinformationApiIngestor>();

// Background service
builder.Services.AddHostedService<IngestorBackgroundService>();

// Controllers
builder.Services.AddControllers();

var app = builder.Build();

app.UseCors();

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
    }
    await db.Database.MigrateAsync();

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
}

app.MapControllers();

app.Run();
