namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Application.Dev;
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
    private readonly IWebHostEnvironment _env;

    public AdminFeatureIdeaController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetIdeas([FromQuery] string? stage)
    {
        var query = _db.FeatureIdeas.AsQueryable();
        if (!string.IsNullOrWhiteSpace(stage)) query = query.Where(i => i.Stage == stage);

        var ideas = await query
            .OrderBy(i => i.Priority)
            .ThenByDescending(i => i.UpdatedAt)
            .Select(i => new
            {
                i.Id,
                i.IdeaNumber,
                i.Title,
                i.Stage,
                i.Priority,
                i.KällaTyp,
                i.FlagKey,
                i.CreatedAt,
                i.UpdatedAt,
            })
            .ToListAsync();

        return Ok(ideas);
    }

    // Admin ordnar idéerna fritt genom att dra dem i listan — det här sätter hela
    // prioritetsordningen i ett svep (index i OrderedIds blir Priority), inte en
    // enstaka idés plats. Ren omordning bumpar INTE UpdatedAt — det är inte en
    // innehållsändring, bara var idén råkar ligga i listan just nu.
    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder([FromBody] ReorderFeatureIdeasRequest req)
    {
        if (req.OrderedIds == null || req.OrderedIds.Count == 0) return BadRequest("OrderedIds krävs.");
        if (req.OrderedIds.Distinct().Count() != req.OrderedIds.Count) return BadRequest("OrderedIds innehåller dubbletter.");

        var alla = await _db.FeatureIdeas.ToListAsync();
        if (req.OrderedIds.Count != alla.Count) return BadRequest("OrderedIds måste innehålla samtliga idéer exakt en gång.");

        var byId = alla.ToDictionary(i => i.Id);
        foreach (var id in req.OrderedIds)
            if (!byId.ContainsKey(id)) return BadRequest($"Okänd idé: {id}.");

        for (var idx = 0; idx < req.OrderedIds.Count; idx++)
            byId[req.OrderedIds[idx]].Priority = idx;

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> CreateIdea([FromBody] CreateFeatureIdeaRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title krävs.");

        var nextNumber   = (await _db.FeatureIdeas.MaxAsync(i => (int?)i.IdeaNumber) ?? 0) + 1;
        // Nya idéer hamnar sist i prioritetsordningen (lägst prio) som standard —
        // admin flyttar upp den manuellt om den faktiskt ska prioriteras högre.
        var nextPriority = (await _db.FeatureIdeas.MaxAsync(i => (int?)i.Priority) ?? -1) + 1;

        var idea = new FeatureIdea
        {
            IdeaNumber      = nextNumber,
            Title           = req.Title,
            Description     = req.Description ?? string.Empty,
            KällaTyp        = req.KällaTyp ?? "admin",
            SourceTicketId  = req.SourceTicketId,
            CreatedByUserId = CurrentUserId,
            Priority        = nextPriority,
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
                c.Fas,
                c.Label,
                c.Done,
                c.DoneAt,
                DoneByName = c.DoneByUser != null ? c.DoneByUser.Name : null,
            })
            .ToListAsync();

        // Testfilerna pekar bara på en sökväg — antal/testnamn slås upp mot
        // katalogen vid varje hämtning (inte cachat på raden), så siffran
        // alltid matchar senast genererade test-catalog.json.
        var catalog = TestCatalog.Load(_env.ContentRootPath);
        var testFiles = await _db.FeatureIdeaTestFiles
            .Where(t => t.FeatureIdeaId == id)
            .OrderBy(t => t.FilePath)
            .ToListAsync();
        var testFilesMedAntal = testFiles.Select(t =>
        {
            var post = TestCatalog.Find(catalog, t.FilePath);
            return new
            {
                t.Id,
                t.FilePath,
                ClassName = post?.ClassName,
                Count     = post?.Count ?? 0,
                Names     = post?.Names ?? [],
                Okänd     = post == null,
            };
        }).ToList();

        return Ok(new { Idea = idea, Testers = testers, Checklist = checklist, TestFiles = testFilesMedAntal });
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
                    _db.FeatureIdeaChecklistItems.Add(new FeatureIdeaChecklistItem { FeatureIdeaId = id, Label = label, Fas = "lansering" });
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

        var normalizedEmail = EmailNormalizer.Normalize(req.Email);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
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

        var fas = req.Fas == "testning" ? "testning" : "lansering";

        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        var item = new FeatureIdeaChecklistItem { FeatureIdeaId = id, Label = req.Label, Fas = fas };
        _db.FeatureIdeaChecklistItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    // Automatiska tester — admin kopplar en RIKTIG testfil (sökväg måste
    // finnas i test-catalog.json) till idén, i stället för fri text.
    [HttpPost("{id}/test-files")]
    public async Task<IActionResult> AddTestFile(Guid id, [FromBody] AddTestFileRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FilePath)) return BadRequest("FilePath krävs.");

        var idea = await _db.FeatureIdeas.FindAsync(id);
        if (idea == null) return NotFound();

        var catalog = TestCatalog.Load(_env.ContentRootPath);
        if (TestCatalog.Find(catalog, req.FilePath) == null)
            return BadRequest("Okänd testfil — finns inte i test-catalog.json.");

        var finnsRedan = await _db.FeatureIdeaTestFiles.AnyAsync(t => t.FeatureIdeaId == id && t.FilePath == req.FilePath);
        if (finnsRedan) return Conflict("Testfilen är redan kopplad till den här idén.");

        _db.FeatureIdeaTestFiles.Add(new FeatureIdeaTestFile { FeatureIdeaId = id, FilePath = req.FilePath });
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}/test-files/{testFileId}")]
    public async Task<IActionResult> RemoveTestFile(Guid id, Guid testFileId)
    {
        var rad = await _db.FeatureIdeaTestFiles.FirstOrDefaultAsync(t => t.Id == testFileId && t.FeatureIdeaId == id);
        if (rad == null) return NotFound();

        _db.FeatureIdeaTestFiles.Remove(rad);
        await _db.SaveChangesAsync();
        return Ok();
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
public record ReorderFeatureIdeasRequest(List<Guid> OrderedIds);
public record UpdateFeatureIdeaRequest(string? Title, string? Description, string? FlagKey);
public record SetStageRequest(string Stage);
public record SetTriageRequest(bool? KanGoras, bool? BorGoras, string? Motivering);
public record AddTesterRequest(string Email);
public record AddChecklistItemRequest(string Label, string? Fas = null);
public record ToggleChecklistItemRequest(bool Done);
public record AddTestFileRequest(string FilePath);
