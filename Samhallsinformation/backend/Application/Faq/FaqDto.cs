namespace Samhallsinformation.Application.Faq;

using Samhallsinformation.Models;

/// <summary>
/// Det en FAQ-fråga får visa utåt i publika GET /api/faq. En vitlista: exakt
/// kontraktet mot kundtjänstboten (docs/vault/Ideer/FAQ-synk-kundtjanstbot.md).
/// FlagKey är kvar eftersom FaqKort.tsx filtrerar på den och boten har den i
/// sitt kontrakt. Den visar bara nycklar för funktioner som redan är synliga,
/// eftersom endpointen filtrerar bort resten. Medvetet utelämnat: Publicerad
/// (alltid true här).
/// </summary>
public sealed record FaqDto(
    Guid Id,
    string Kategori,
    string Fraga,
    string Svar,
    string? FlagKey,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static FaqDto From(FaqItem f) => new(f.Id, f.Kategori, f.Fraga, f.Svar, f.FlagKey, f.CreatedAt, f.UpdatedAt);
}
