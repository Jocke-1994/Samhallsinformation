namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;

[ApiController]
[Authorize(Roles = "Admin")]
public class TestingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public TestingController(AppDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    // Händelser från aktiva men opublicerade källor — redan ingestade, bara dolda för besökare
    [HttpGet("/api/admin/testing/preview")]
    public async Task<IActionResult> Preview()
    {
        var testSources = await _db.Sources
            .Where(s => s.IsActive && !s.IsPublished)
            .ToListAsync();

        var sourceIds = testSources.Select(s => s.Id).ToList();

        var events = await _db.Events
            .Where(e => sourceIds.Contains(e.SourceId))
            .OrderByDescending(e => e.PublishedAt)
            .Take(200)
            .ToListAsync();

        var result = testSources.Select(s => new
        {
            sourceId = s.Id,
            sourceName = s.Name,
            events = events.Where(e => e.SourceId == s.Id).ToList(),
        });

        return Ok(result);
    }

    // Kör en RSS-URL mot ingestorn utan att spara — dry run / sandlåda
    [HttpPost("/api/admin/testing/dryrun")]
    public async Task<IActionResult> DryRun([FromBody] DryRunRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Url))
            return BadRequest(new { error = "URL krävs" });

        var domain = Uri.TryCreate(req.Url, UriKind.Absolute, out var uri) ? uri.Host : req.Url;
        var tempSource = new Source
        {
            Id = 0,
            Name = req.Name ?? domain,
            ShortName = req.Name ?? domain,
            BaseUrl = req.Url,
            Url = req.Url,
            Type = SourceType.RSS,
            IsActive = false,
            IsPublished = false,
        };

        var httpClient = _httpClientFactory.CreateClient();
        var ingestor = new GenericRssIngestor(httpClient, tempSource);

        try
        {
            var events = await ingestor.FetchEventsAsync();
            return Ok(new { count = events.Count, events });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public record DryRunRequest(string Url, string? Name);
