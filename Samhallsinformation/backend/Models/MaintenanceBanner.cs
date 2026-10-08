namespace Samhallsinformation.Models;

// En rad per driftmeddelande — flera kan vara aktiva samtidigt (t.ex. ett för
// alla och ett riktat bara till inloggade), till skillnad från en enda
// singleton-rad som bara kan uttrycka ett meddelande i taget.
public class MaintenanceBanner
{
    public Guid     Id        { get; set; }
    public string   Message   { get; set; } = "";
    public DateTime StartUtc  { get; set; }
    public DateTime EndUtc    { get; set; }

    // "Alla" | "Besökare" (utloggade) | "Användare" (inloggade) — samma
    // fritextsträng-konvention som User.Role, inget separat enum-lager.
    public string   Audience  { get; set; } = "Alla";
    public DateTime CreatedAt { get; set; }

    // "Drift" (orange, underhåll/störning) | "Nyhet" (violett, lanserad
    // funktion) | "Kommande" (grön, annonserad men inte släppt funktion).
    // Samma fritextsträng-konvention som Audience.
    public string   Stil      { get; set; } = "Drift";

    // Valfri första rad ovanför Message, t.ex. "Nytt på Samhällsinformation".
    public string?  Rubrik    { get; set; }

    // Valfri "Läs mer"-länk. Bara interna sökvägar ("/uppdateringar") —
    // validerat i controllern så en banderoll aldrig kan peka ut ur sajten.
    public string?  LankUrl   { get; set; }
}
