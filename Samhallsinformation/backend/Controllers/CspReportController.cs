namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Samhallsinformation.Application.Csp;

/// <summary>
/// Mottagare för CSP-rapporter från webbläsare (V3-22, D4 alt B: CSP i rapportera-läge).
/// Anonym per design — webbläsaren skickar rapporten utan inloggning. Ingen affärslogik här:
/// <see cref="ICspReportService"/> läser en begränsad body, sanerar och sparar. Svarar ALLTID 204
/// (även på skräp, för stor body eller databasfel): en rapport är bara en signal, aldrig ett fel.
/// Ingen [Consumes] — content-type (application/csp-report, application/reports+json, application/json)
/// spelar ingen roll och ett 415 vore ett onödigt fel; ingen [RequestSizeLimit] — den ger 413 i stället för 204,
/// gränsen (8 KB) tillämpas i stället vid läsningen.
/// </summary>
[ApiController]
public class CspReportController : ControllerBase
{
    private readonly ICspReportService _reports;

    public CspReportController(ICspReportService reports) => _reports = reports;

    [HttpPost("/api/csp-report")]
    [AllowAnonymous]
    [EnableRateLimiting(CspReportRateLimit.PolicyName)]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        await _reports.HandleAsync(Request.Body, Request.ContentLength, ct);
        return NoContent();
    }
}
