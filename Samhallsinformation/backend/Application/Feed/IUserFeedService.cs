namespace Samhallsinformation.Application.Feed;

using Samhallsinformation.Models;

// En sida ur ett användarspecifikt flöde. Samma form som EventsController
// (total/page/pageSize/events) plus två fält som gör paginering ärlig när
// total inte kan räknas exakt (se UserFeedService):
//   HasMore     - auktoritativt: finns det fler sidor efter den här?
//   TotalExakt  - false = Total är en nedre gräns, inte det verkliga antalet.
public record FeedPage(int Total, int Page, int PageSize, List<CanonicalEvent> Events, bool HasMore, bool TotalExakt);

public interface IUserFeedService
{
    // "Mitt flöde": händelser från användarens aktiva, publicerade källor, med
    // Polisen-händelser dessutom matchade mot användarens bevakningar.
    Task<FeedPage> GetMittFlodeAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);

    // "Sparat": användarens sparade händelser (publicerade källor), nyast först.
    Task<FeedPage> GetSparatAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);
}
