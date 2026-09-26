namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Samhallsinformation.Application.Feed;

// "Mitt flöde" på servern (V3-11): händelser från användarens aktiva, publicerade
// källor, Polisen matchad mot användarens bevakningar. Logiken bor i
// IUserFeedService - se dess kommentarer för avvägningarna kring paginering.
// Ett separat endpoint (inte ?feed=mine på /api/events) så att auktorisering är
// ett attribut och det publika händelseanropet förblir helt oförändrat.
[ApiController]
[Route("api/user/feed")]
[Authorize]
public class UserFeedController : ControllerBase
{
    private readonly IUserFeedService _feed;

    public UserFeedController(IUserFeedService feed) => _feed = feed;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var sida = await _feed.GetMittFlodeAsync(userId, page, pageSize, ct);
        return Ok(new { total = sida.Total, page = sida.Page, pageSize = sida.PageSize, events = sida.Events, hasMore = sida.HasMore, totalExakt = sida.TotalExakt });
    }
}
