namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/admin/feature-ideas")]
[Authorize(Roles = "Admin")]
public class AdminFeatureIdeaController : ControllerBase
{
    // Seedas automatiskt när en idé når "lanseringsklar" första gången —
    // en startpunkt, inte ett tvång. Varje item kan tas bort per idé om
    // det inte är relevant (t.ex. en idé utan FAQ-påverkan).
    private static readonly string[] StandardChecklista =
    [
        "FAQ uppdaterad",
        "Kundtjänstbotens kunskapsbas uppdaterad",
        "Push-notis förberedd",
        "Flagga aktiverad i kod",
    ];

    private readonly AppDbContext _db;

    public AdminFeatureIdeaController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetIdeas([FromQuery] string? stage)
    {
        var query = _db.FeatureIdeas.AsQueryable();
        if (!string.IsNullOrWhiteSpace(stage)) query = query.Where(i => i.Stage == stage);

        var ideas = await query
            .OrderByDescending(i => i.UpdatedAt)
            .Select(i => new
            {
                i.Id,
                i.IdeaNumber,
                i.Title,
                i.Stage,
                i.KällaTyp,
                i.FlagKey,
                i.CreatedAt,
                i.UpdatedAt,
            })
            .ToListAsync();

        return Ok(ideas);
    }

    [HttpPost]
    public async Task<IActionResult> CreateIdea([FromBody] CreateFeatureIdeaRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title krävs.");

        var nextNumber = (await _db.FeatureIdeas.MaxAsync(i => (int?)i.IdeaNumber) ?? 0) + 1;

        var idea = new FeatureIdea
        {
            IdeaNumber      = nextNumber,
            Title           = req.Title,
            Description     = req.Description ?? string.Empty,
            KällaTyp        = req.KällaTyp ?? "admin",
            SourceTicketId  = req.SourceTicketId,
            CreatedByUserId = CurrentUserId,
        };
        _db.FeatureIdeas.Add(idea);
        await _db.SaveChangesAsync();

        return Ok(new { idea.Id, idea.IdeaNumber });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetIdea(Guid id)
    {
        var idea = await _db.FeatureIdeas
            .Where(i => i.Id == id)
            .Select(i => new
            {
                i.Id,
                i.IdeaNumber,
                i.Title,
                i.Description,
                i.Stage,
                i.TriageKanGoras,
                i.TriageBorGoras,
                i.TriageMotivering,
                i.KällaTyp,
                i.SourceTicketId,
                i.FlagKey,
                CreatedByName = i.CreatedByUser.Name,
                i.CreatedAt,
                i.UpdatedAt,
            })
            .FirstOrDefaultAsync();
        if (idea == null) return NotFound();

        var testers = await _db.FeatureIdeaTesters
            .Where(t => t.FeatureIdeaId == id)
            .Select(t => new { t.UserId, Name = t.User.Name, Email = t.User.Email, t.AddedAt })
            .ToListAsync();

        var checklist = await _db.FeatureIdeaChecklistItems
            .Where(c => c.FeatureIdeaId == id)
            .OrderBy(c => c.Label)
            .Select(c => new
            {
                c.Id,
                c.Label,
                c.Done,
                c.DoneAt,
                DoneByName = c.DoneByUser != null ? c.DoneByUser.Name : null,
            })
            .ToListAsync();

        return Ok(new { Idea = idea, Testers = testers, Checklist = checklist });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIdea(Guid id, [FromBody] UpdateFeatureIdeaRequest req)
    {
        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Title)) idea.Title = req.Title;
        idea.Description = req.Description ?? idea.Description;
        idea.FlagKey      = req.FlagKey;
        idea.UpdatedAt    = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPut("{id}/stage")]
    public async Task<IActionResult> SetStage(Guid id, [FromBody] SetStageRequest req)
    {
        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        // Bara sidoeffekterna nedan (checklista, redo-markering) ska
        // triggas vid en FAKTISK stadieändring — inte vid ett omklick på
        // redan valt stadium (code review-fynd, PR #590: ett omklick på en
        // redan aktiv "lanseringsklar"-pill återställde tyst en flagga som
        // admin medvetet avmarkerat som "inte redo" i Feature flags-panelen).
        var stageÄndrades   = idea.Stage != req.Stage;
        var föregåendeStage = idea.Stage;

        idea.Stage     = req.Stage;
        idea.UpdatedAt = DateTime.UtcNow;

        if (stageÄndrades && req.Stage == "lanseringsklar")
        {
            var harChecklista = await _db.FeatureIdeaChecklistItems.AnyAsync(c => c.FeatureIdeaId == id);
            if (!harChecklista)
            {
                foreach (var label in StandardChecklista)
                    _db.FeatureIdeaChecklistItems.Add(new FeatureIdeaChecklistItem { FeatureIdeaId = id, Label = label });
            }

            // Markera den kopplade flaggan "redo att lanseras" automatiskt —
            // spar admin ett extra steg i Feature flags-panelen. Rör aldrig
            // Value (bara synligheten i Uppdateringars urvalslista).
            if (!string.IsNullOrWhiteSpace(idea.FlagKey))
            {
                var flagg = await FeatureFlagActivation.GetOrCreateOverrideAsync(_db, idea.FlagKey);
                flagg.RedoAttLanseras = true;
            }
        }
        else if (stageÄndrades && föregåendeStage == "lanseringsklar" && !string.IsNullOrWhiteSpace(idea.FlagKey))
        {
            // Idén flyttas BORT från "lanseringsklar" (nedgraderad) — flaggan
            // ska inte längre visas som redo, annars kan den dyka upp i
            // Uppdateringars schemaläggningslista trots att idén inte längre
            // anses klar.
            var flagg = await _db.FeatureFlagOverrides.FindAsync(idea.FlagKey);
            if (flagg != null) flagg.RedoAttLanseras = false;
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPut("{id}/triage")]
    public async Task<IActionResult> SetTriage(Guid id, [FromBody] SetTriageRequest req)
    {
        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        idea.TriageKanGoras   = req.KanGoras;
        idea.TriageBorGoras   = req.BorGoras;
        idea.TriageMotivering = req.Motivering;
        idea.UpdatedAt        = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id}/testers")]
    public async Task<IActionResult> AddTester(Guid id, [FromBody] AddTesterRequest req)
    {
        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null) return NotFound("Ingen användare med den e-posten.");

        var finnsRedan = await _db.FeatureIdeaTesters.AnyAsync(t => t.FeatureIdeaId == id && t.UserId == user.Id);
        if (finnsRedan) return Conflict("Användaren är redan testare på den här idén.");

        _db.FeatureIdeaTesters.Add(new FeatureIdeaTester { FeatureIdeaId = id, UserId = user.Id });
        await _db.SaveChangesAsync();
        return Ok(new { user.Id, user.Name, user.Email });
    }

    [HttpDelete("{id}/testers/{userId}")]
    public async Task<IActionResult> RemoveTester(Guid id, Guid userId)
    {
        var tester = await _db.FeatureIdeaTesters.FirstOrDefaultAsync(t => t.FeatureIdeaId == id && t.UserId == userId);
        if (tester == null) return NotFound();

        _db.FeatureIdeaTesters.Remove(tester);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id}/checklist")]
    public async Task<IActionResult> AddChecklistItem(Guid id, [FromBody] AddChecklistItemRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Label)) return BadRequest("Label krävs.");

        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        var item = new FeatureIdeaChecklistItem { FeatureIdeaId = id, Label = req.Label };
        _db.FeatureIdeaChecklistItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    [HttpPut("{id}/checklist/{itemId}")]
    public async Task<IActionResult> ToggleChecklistItem(Guid id, Guid itemId, [FromBody] ToggleChecklistItemRequest req)
    {
        var item = await _db.FeatureIdeaChecklistItems.FirstOrDefaultAsync(c => c.Id == itemId && c.FeatureIdeaId == id);
        if (item == null) return NotFound();

        item.Done       = req.Done;
        item.DoneAt     = req.Done ? DateTime.UtcNow : null;
        item.DoneByUserId = req.Done ? CurrentUserId : null;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}/checklist/{itemId}")]
    public async Task<IActionResult> RemoveChecklistItem(Guid id, Guid itemId)
    {
        var item = await _db.FeatureIdeaChecklistItems.FirstOrDefaultAsync(c => c.Id == itemId && c.FeatureIdeaId == id);
        if (item == null) return NotFound();

        _db.FeatureIdeaChecklistItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIdea(Guid id)
    {
        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        _db.FeatureIdeas.Remove(idea);
        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record CreateFeatureIdeaRequest(string Title, string? Description, string? KällaTyp, Guid? SourceTicketId);
public record UpdateFeatureIdeaRequest(string? Title, string? Description, string? FlagKey);
public record SetStageRequest(string Stage);
public record SetTriageRequest(bool? KanGoras, bool? BorGoras, string? Motivering);
public record AddTesterRequest(string Email);
public record AddChecklistItemRequest(string Label);
public record ToggleChecklistItemRequest(bool Done);
