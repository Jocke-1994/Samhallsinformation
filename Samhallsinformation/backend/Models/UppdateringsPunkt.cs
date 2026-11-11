namespace Samhallsinformation.Models;

public class UppdateringsPunkt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UppdateringId { get; set; }
    public Uppdatering Uppdatering { get; set; } = null!;

    /// <summary>ny-funktion | förbättring | buggfix | känt-problem | kommer-snart</summary>
    public string Typ { get; set; } = "ny-funktion";
    public string Plats { get; set; } = "Allmänt";
    public string Text { get; set; } = "";

    /// <summary>
    /// "alla" (syns för utloggade besökare på Nyheter-sidan också) eller
    /// "inloggade" (bara i profilens Uppdateringar-flik). Löser buggen i
    /// PR #581 där inloggad-bara innehåll läckte till besökarsidan —
    /// filtreras klientsidan per punkt, inte per hel release.
    /// </summary>
    public string Synlighet { get; set; } = "alla";

    /// <summary>
    /// "Prova själv"-länkens mål (Ideer/Prova-sjalv-lankar.md), en nyckel ur
    /// <c>UppdateringsVärden.ProvaSjalvMål</c>, eller null = ingen länk. En fast
    /// lista i stället för fritext-URL: går inte att skriva fel, och frontend
    /// avgör själv adress, flagga och om det kräver konto.
    /// </summary>
    public string? ProvaSjalv { get; set; }

    /// <summary>Satt = index i punkter-listan vid spara, ingen manuell omordning.</summary>
    public int Ordning { get; set; }
}
