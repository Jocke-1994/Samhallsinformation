using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Services;

var builder = WebApplication.CreateBuilder(args);

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
        // PostgreSQL: befintliga migrationer har SQLite-specifika typer (INTEGER för bool etc.)
        // Droppa och återskapa med EnsureCreated som använder korrekta PostgreSQL-typer.
        // Ingestorerna fyller på data igen inom 5 min.
        await db.Database.ExecuteSqlRawAsync(@"
            DROP TABLE IF EXISTS ""Events"";
            DROP TABLE IF EXISTS ""UserPreferences"";
            DROP TABLE IF EXISTS ""Sources"";
            DROP TABLE IF EXISTS ""__EFMigrationsHistory"";
        ");
        await db.Database.EnsureCreatedAsync();
    }
    else
    {
        await db.Database.MigrateAsync();
    }

    foreach (var ingestor in ingestors)
    {
        var source = ingestor.Source;
        if (!db.Sources.Any(s => s.Id == source.Id))
            db.Sources.Add(source);
    }

    await db.SaveChangesAsync();
}

app.MapControllers();

app.Run();
