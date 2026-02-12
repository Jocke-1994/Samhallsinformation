using Samhallsinformation.Ingestors;

Console.WriteLine("=== Samhällsinformation - Sprint 2: RSS Ingestor ===");
Console.WriteLine();

using var httpClient = new HttpClient();
var ingestor = new PolisenRssIngestor(httpClient);

Console.WriteLine($"Hämtar händelser från: {ingestor.Source.Name} ({ingestor.Source.ShortName})");
Console.WriteLine($"Källtyp: {ingestor.Source.Type}");
Console.WriteLine();

try
{
    var events = await ingestor.FetchEventsAsync();

    Console.WriteLine($"Antal händelser hämtade: {events.Count}");
    Console.WriteLine(new string('-', 60));

    foreach (var evt in events)
    {
        Console.WriteLine($"  Titel:     {evt.Title}");
        Console.WriteLine($"  Geografi:  {evt.Geography ?? "(nationell)"}");
        Console.WriteLine($"  Nationell: {evt.IsNational}");
        Console.WriteLine($"  Allvar:    {evt.Severity}");
        Console.WriteLine($"  Datum:     {evt.PublishedAt:yyyy-MM-dd HH:mm}");
        Console.WriteLine($"  Länk:      {evt.Url}");
        Console.WriteLine(new string('-', 60));
    }
}
catch (HttpRequestException ex)
{
    Console.WriteLine($"Kunde inte hämta data: {ex.Message}");
}

Console.WriteLine();
Console.WriteLine("Tryck på valfri tangent för att avsluta...");
Console.ReadKey();
