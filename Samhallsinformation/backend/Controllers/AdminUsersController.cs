namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminUsersController(AppDbContext db) => _db = db;

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return BadRequest("email krävs.");

        var user = await _db.Users
            .Where(u => u.Email == email)
            .Select(u => new { u.Id, u.Name, u.Email })
            .FirstOrDefaultAsync();

        if (user == null) return NotFound();
        return Ok(user);
    }

    // Ingen paginering/sökning än — en enda admin, inte ett skalproblem
    // förrän listan faktiskt blir stor.
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Role,
                u.IsActive,
                u.SuspendedAt,
                u.SuspendedReason,
                u.AuthProvider,
                u.CreatedAt,
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetUserStatusRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.IsActive = req.IsActive;
        user.SuspendedAt     = req.IsActive ? null : DateTime.UtcNow;
        user.SuspendedReason = req.IsActive ? null : req.Reason;

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record SetUserStatusRequest(bool IsActive, string? Reason);
