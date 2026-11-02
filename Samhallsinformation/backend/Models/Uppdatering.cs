namespace Samhallsinformation.Models;

public class Uppdatering
{
    public Guid     Id         { get; set; } = Guid.NewGuid();
    public string   Titel      { get; set; } = "";
    public DateTime Datum      { get; set; }
    public bool     Publicerad { get; set; } = false;
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt  { get; set; } = DateTime.UtcNow;

    // Satt när posten schemaläggs istället för att publiceras direkt.
    // ScheduledReleaseBackgroundService nollställer detta när den är klar
    // (bearbetad), oavsett om Publicerad faktiskt blev true eller ej.
    public DateTime? SchemalagdPubliceringUtc { get; set; }

    // JSON string[] av feature-flag-nycklar som ska aktiveras (Value=true)
    // samtidigt som schemat slår in — samma JSON-kolumn-mönster som
    // UserPolisenFilter.KategorierJson. Serialiseras i controllern.
    public string? SchemalagdaFlaggorJson { get; set; }

    // Del 2 av Schemalagd lanserings "Ny version"-tillägg (Beslut 2026-10-08,
    // se Verktyg/Schemalagd-lansering.md). Bara meningsfulla tillsammans med
    // SchemalagdPubliceringUtc — ScheduledReleaseBackgroundService läser dem
    // vid lanseringstidpunkten, aldrig vid sparande. Kräver att releasen
    // faktiskt har innehåll (UppdateringsPunkter), annars finns inget att
    // pusha eller visa en banderoll om.
    /// <summary>
    /// Versionsnummer, t.ex. "1.1" (beslut 2026-11-02: inloggningen 15 sep = 1.0).
    /// Visas som bricka på kortet, i Vad är nytt-rutan och i historiken, och är
    /// det nummer "Ny version"-pushen använder när PushVersion inte satts.
    /// </summary>
    public string? Version { get; set; }

    public bool    SkickaPush     { get; set; } = false;
    public string? PushVersion    { get; set; }
    public string? PushMeddelande { get; set; }
    public bool    VisaBanderoll  { get; set; } = false;

    // Del 3: annonsering i förväg (Beslut 2026-10-08). AnnonseringUtc är
    // admins valda första tidpunkt (fas 1) — SchemalagdPubliceringUtc ovan
    // återanvänds som fas 2 (lansering). AnnonseradUtc sätts av bakgrunds-
    // tjänsten när fas 1 faktiskt körs (idempotens-vakt, samma mönster som
    // att SchemalagdPubliceringUtc nollställs efter fas 2) — annars skulle
    // en flerdagarsväntan mellan annonsering och lansering trigga om
    // push/banderoll vid varje 60s-poll. Null = ingen annonsering vald,
    // eller fas 1 har inte körts än.
    public DateTime? AnnonseringUtc { get; set; }
    public DateTime? AnnonseradUtc  { get; set; }

    // "Annonsering" | "Lansering" | "Båda" — vilken fas SkickaPush gäller
    // för. Bara meningsfullt när AnnonseringUtc är satt; annars är
    // "Lansering" alltid det enda som faktiskt kan inträffa (bakåtkompatibelt
    // med Del 2, som bara kände till en enda tidpunkt).
    public string PushSkickaVid { get; set; } = "Lansering";

    // Vad är nytt-rutan (Ideer/Vad ar nytt-modal.md, beslut 2026-11-02): visas
    // en gång för inloggade som inte sett den. Till skillnad från VisaBanderoll
    // är den oberoende av schemaläggning — den läses när någon besöker sajten,
    // inte vid en viss tidpunkt. Se UppdateringarController.GetVadÄrNytt.
    public bool VisaVadArNytt { get; set; } = false;
}
