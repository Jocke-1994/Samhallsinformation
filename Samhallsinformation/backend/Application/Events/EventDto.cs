namespace Samhallsinformation.Application.Events;

using Samhallsinformation.Models;

/// <summary>
/// Det en händelse får visa utåt (#729). En vitlista: exakt de fält frontend läser
/// (CanonicalEvent i frontend/src/types/index.ts). Ett nytt fält i databasmodellen
/// syns inte utåt förrän någon medvetet lägger till det här.
/// Medvetet utelämnat: RawData, ExternalId, IngestedAt, UpdatedAt.
/// </summary>
public sealed record EventDto(
    Guid Id,
    int SourceId,
    string Title,
    string Content,
    DateTime PublishedAt,
    string Url,
    string? Geography,
    string? EventType,
    string Severity,
    bool IsNational)
{
    public static EventDto From(CanonicalEvent e) => new(
        e.Id, e.SourceId, e.Title, e.Content, e.PublishedAt, e.Url,
        e.Geography, e.EventType, e.Severity, e.IsNational);
}
