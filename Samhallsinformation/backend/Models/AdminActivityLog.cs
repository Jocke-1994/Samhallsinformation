namespace Samhallsinformation.Models;

// Ursprungligen bara Kontoåtgärder (Sparat-ändringar) som admin/support tar åt
// en användares räkning i Användarhantering/Händelsesök. Låg tidigare bara i
// frontendens localStorage (si_admin_aktivitetslogg) — osynlig för andra
// admin/support-konton och försvann vid webbläsarbyte. Ångra-fälten är en
// platt ögonblicksbild av vad som ändrades, inte en FK — samma mönster som
// UserSettingAuditLogs OldValue/NewValue.
//
// Breddad (issue #491, wave 1) till den generella sanningskällan för alla
// admin/system-händelser — se Application/Aktivitetslogg/IAktivitetsloggService.
// AktörTyp/GammaltVärde/NyttVärde/Ip/Enhet/Arkiverad/Test är nya fält för det;
// befintliga rader backfillas AktörTyp="Admin" i migrationen (de är alla
// Kontoåtgärd, admin/support-initierade).
public class AdminActivityLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime Tid { get; set; } = DateTime.UtcNow;
    public string Vem { get; set; } = "";
    public string AktörTyp { get; set; } = "Admin"; // "System" | "Admin" — sträng, inte enum-kolumn, samma mönster som Typ
    public string Typ { get; set; } = "";
    public string Rubrik { get; set; } = "";
    public string Detalj { get; set; } = "";
    public bool Ångrad { get; set; }

    // Ingen riktig radering av loggposter (skulle underminera spårbarheten) —
    // arkivering + test-taggning istället, båda döljs ur standardvyn.
    public bool Arkiverad { get; set; }
    public bool Test { get; set; } // taggas vid SKAPANDET mot kända test-/betakonton

    public string? Ip { get; set; }
    public string? Enhet { get; set; } // User-Agent
    public string? GammaltVärde { get; set; } // breddar UserSettingAuditLogs OldValue/NewValue-mönster
    public string? NyttVärde { get; set; }

    // Sätts för Typ=Ärende-rader — låter Aktivitetslogg/Översikt länka direkt
    // till ärendet i Support-inbox istället för att bara nämna det i text.
    public Guid? RelateratÄrendeId { get; set; }

    public string? AngraAnvandareId { get; set; }
    public string? AngraEventId { get; set; }
    public string? AngraTitle { get; set; }
    public string? AngraSourceName { get; set; }
    public string? AngraPublishedAt { get; set; }
    public string? AngraSparadDatum { get; set; }
    public string? AngraUndoAction { get; set; }
}
