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

app.MapControllers();

app.Run();
