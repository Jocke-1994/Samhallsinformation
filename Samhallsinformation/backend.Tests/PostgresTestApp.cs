namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Samhallsinformation.Data;
using Samhallsinformation.Infrastructure;
using Samhallsinformation.Ingestors;

/// <summary>
/// Bygger en RIKTIG <see cref="WebApplication"/> (samma DI-typ produktionens Program.cs bygger),
/// konfigurerad mot en Postgres-connection string, och kör den FAKTISKA uppstartslogiken
/// (<see cref="DatabaseBootstrapper.RunAsync"/> — samma metod Program.cs anropar, se V4-6b) mot den.
///
/// Medvetet EN smalare DI-uppsättning än produktionens Program.cs: bara det
/// <see cref="DatabaseBootstrapper"/> faktiskt behöver (AppDbContext + de fyra DI-registrerade
/// <see cref="IIngestor"/>-implementationerna, för källseedningen). Ingen JWT/CORS/rate limiting/
/// push/mejl-uppsättning — inget av det läses av bootstrap-logiken, och att bygga en fullständig
/// kopia av HELA Program.cs:s builder-sektion här (utanför själva testade metoden) hade bara varit
/// en till plats att glömma synka. Anslutningssträngen sätts direkt via UseNpgsql (ingen SSL, ingen
/// DATABASE_URL/PGHOST-env-var-parsning) eftersom Testcontainers postgres-avbildningen inte
/// exponerar SSL — Program.cs egna env-var-grenar tvingar "SSL Mode=Require", vilket en
/// Testcontainers-container inte pratar. Se DatabaseBootstrapper.RunAsync: den avgör Postgres vs
/// SQLite via <c>db.Database.IsNpgsql()</c>, inte via de env-variablerna, så det här är fortfarande
/// EXAKT samma körväg som produktionen tar.
/// </summary>
public static class PostgresTestApp
{
    /// <summary>
    /// Bygger appen, kör hela migrations-/seed-uppstarten mot <paramref name="connectionString"/>,
    /// och returnerar den färdigbyggda <see cref="WebApplication"/>. Kallaren äger disponeringen
    /// (<c>await using</c>) — Kestrel startas aldrig (ingen <c>Run()</c>/<c>StartAsync()</c> anropas),
    /// så inget lyssnar på någon port.
    /// </summary>
    public static async Task<WebApplication> BuildAndBootstrapAsync(string connectionString)
    {
        var builder = WebApplication.CreateBuilder();

        builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

        // Samma fyra IIngestor-registreringar som Program.cs (rad ~148–155) — källseedningen
        // (IngestorSourceSeeder.SeedAsync) itererar över dessa för att veta vilka Source-rader
        // som ska finnas efter en tom start.
        builder.Services.AddHttpClient<PolisenRssIngestor>();
        builder.Services.AddHttpClient<KrisinformationApiIngestor>();
        builder.Services.AddHttpClient<TrafikverketApiIngestor>();
        builder.Services.AddHttpClient<SmhiApiIngestor>();
        builder.Services.AddScoped<IIngestor, PolisenRssIngestor>();
        builder.Services.AddScoped<IIngestor, KrisinformationApiIngestor>();
        builder.Services.AddScoped<IIngestor, TrafikverketApiIngestor>();
        builder.Services.AddScoped<IIngestor, SmhiApiIngestor>();

        var app = builder.Build();

        await DatabaseBootstrapper.RunAsync(app);

        return app;
    }
}
