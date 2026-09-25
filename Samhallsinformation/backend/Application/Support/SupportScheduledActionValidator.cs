namespace Samhallsinformation.Application.Support;

/// <summary>
/// Indatavalidering för <c>POST /api/admin/support/tickets/{id}/scheduled-actions</c> (E4 #8).
/// Typerna är exakt de som <c>SupportScheduledActionService</c> hanterar.
/// </summary>
public static class SupportScheduledActionValidator
{
    public const string Svar = "svar";
    public const string Intern = "intern";
    public const string Tilldela = "tilldela";

    public const int MaxTextLength = SupportTicketValidator.MaxMessageLength; // 5000
    public const int MaxInstructionLength = 1000;

    public static readonly IReadOnlyList<string> AllowedTypes = [Svar, Intern, Tilldela];

    /// <summary>Ärendestatusar som räknas som avslutade (samma som adminpanelens "stängt").</summary>
    public static bool IsClosed(string status) => status is "Hanterat" or "Stängt";

    /// <summary>
    /// Normaliserar till UTC: Utc behålls, Local konverteras, Unspecified tolkas som UTC
    /// (annars vägrar Npgsql skriva en timestamptz med fel <c>Kind</c>).
    /// </summary>
    public static DateTime NormalizeToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc   => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _                  => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    /// <summary>Returnerar ett svenskt felmeddelande, eller null om indatan är giltig.</summary>
    public static string? Validate(string? type, DateTime scheduledAtUtc, string? text, string? instruction, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(type) || !AllowedTypes.Contains(type))
            return $"Okänd åtgärdstyp. Tillåtna typer: {string.Join(", ", AllowedTypes)}.";

        if (scheduledAtUtc <= nowUtc)
            return "Tidpunkten måste ligga i framtiden.";

        if (type is Svar or Intern)
        {
            if (string.IsNullOrWhiteSpace(text))
                return type == Svar ? "Svarstexten får inte vara tom." : "Anteckningen får inte vara tom.";
            if (text.Length > MaxTextLength)
                return $"Texten får vara högst {MaxTextLength} tecken.";
        }

        if (instruction != null && instruction.Length > MaxInstructionLength)
            return $"Instruktionen får vara högst {MaxInstructionLength} tecken.";

        return null;
    }
}
