namespace Samhallsinformation.Application.Uppdateringar;

/// <summary>
/// Formaterar ett UTC-datum som "15 oktober" i svensk lokal tid (Beslut
/// 2026-10-08 — annonserings-/lanseringstexter i push och banderoll).
/// Hårdkodad månadslista i stället för CultureInfo("sv-SE"): om servern
/// körs med Invariant Globalization (vanligt i trimmade container-images)
/// kastar CultureInfo.GetCultureInfo, medan TimeZoneInfo-uppslagning (redan
/// använt i ResendEmailService) inte beror på den inställningen.
/// </summary>
public static class SvenskDatum
{
    private static readonly string[] Månader =
    [
        "januari", "februari", "mars", "april", "maj", "juni",
        "juli", "augusti", "september", "oktober", "november", "december",
    ];

    public static string FormateraDag(DateTime utc)
    {
        var stockholmTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");
        var lokalTid = TimeZoneInfo.ConvertTimeFromUtc(utc, stockholmTz);
        return $"{lokalTid.Day} {Månader[lokalTid.Month - 1]}";
    }
}
