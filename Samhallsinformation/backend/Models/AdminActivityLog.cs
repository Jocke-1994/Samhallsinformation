namespace Samhallsinformation.Models;

// Kontoåtgärder (idag: Sparat-ändringar) som admin/support tar åt en
// användares räkning i Användarhantering/Händelsesök. Låg tidigare bara i
// frontendens localStorage (si_admin_aktivitetslogg) — osynlig för andra
// admin/support-konton och försvann vid webbläsarbyte. Ångra-fälten är en
// platt ögonblicksbild av vad som ändrades, inte en FK — samma mönster som
// UserSettingAuditLogs OldValue/NewValue.
public class AdminActivityLog
{
    public Guid     Id     { get; set; } = Guid.NewGuid();
    public DateTime Tid    { get; set; } = DateTime.UtcNow;
    public string   Vem    { get; set; } = "";
    public string   Typ    { get; set; } = "";
    public string   Rubrik { get; set; } = "";
    public string   Detalj { get; set; } = "";
    public bool     Ångrad { get; set; }

    public string?  AngraAnvandareId { get; set; }
    public string?  AngraEventId     { get; set; }
    public string?  AngraTitle       { get; set; }
    public string?  AngraSourceName  { get; set; }
    public string?  AngraPublishedAt { get; set; }
    public string?  AngraSparadDatum { get; set; }
    public string?  AngraUndoAction  { get; set; }
}
