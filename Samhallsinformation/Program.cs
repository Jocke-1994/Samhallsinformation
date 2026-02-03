using Samhallsinformation.Models; // Importera din nya mapp

Console.WriteLine("--- Sprint 1: Verifiering av CanonicalEvent ---");

// 1. Skapa en testkälla (Polisen) enligt din modell
var polisen = new Source
{
    Id = 1,
    Name = "Polisen",
    ShortName = "polisen.se",
    Type = SourceType.RSS,
    IsActive = true
};

// 2. Skapa ett test-event baserat på din Master-modell
var incident = new CanonicalEvent
{
    SourceId = polisen.Id,
    Title = "Inbrott i lägenhet, Malmö",
    Content = "Ett larm inkom klockan 02:00...",
    PublishedAt = DateTime.Now,
    Geography = "Malmö",
    Url = "https://polisen.se/aktuellt/handelser/...",
    Severity = "Bra att veta" // Din fallback enligt punkt 7
};

Console.WriteLine($"Källa: {polisen.Name}");
Console.WriteLine($"Händelse mappad: {incident.Title} i {incident.Geography}");

Console.WriteLine("\nTryck på valfri tangent för att avsluta...");
Console.ReadKey();