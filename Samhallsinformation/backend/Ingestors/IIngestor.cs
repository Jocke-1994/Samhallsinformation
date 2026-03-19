namespace Samhallsinformation.Ingestors;

using Samhallsinformation.Models;

public interface IIngestor
{
    Source Source { get; }

    Task<List<CanonicalEvent>> FetchEventsAsync();
}
