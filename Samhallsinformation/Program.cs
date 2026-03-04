using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Services;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=samhallsinformation.db"));

// HTTP client for ingestors
builder.Services.AddHttpClient<PolisenRssIngestor>();
builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();

// Background service
builder.Services.AddHostedService<IngestorBackgroundService>();

// Controllers
builder.Services.AddControllers();

var app = builder.Build();

// Seed: spara källorna från alla ingestors i databasen om de inte redan finns
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var ingestor = scope.ServiceProvider.GetRequiredService<IIngestor>();
    var source = ingestor.Source;

    if (!db.Sources.Any(s => s.Id == source.Id))
    {
        db.Sources.Add(source);
        await db.SaveChangesAsync();
    }
}

app.MapControllers();

app.Run();
