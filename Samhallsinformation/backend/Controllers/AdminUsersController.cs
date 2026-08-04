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

    // Minimal uppslagning på e-post — inte en fullständig användarlista.
    // Anvandare.tsx är fortfarande 100% mock, ingen GET /api/admin/users
    // finns än. Den här endpointen finns bara för att kunna hitta en
    // specifik, riktig användare (t.ex. för att lägga till som testare
    // på en funktionsidé) utan att bygga hela listnings-API:et i förväg.
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
}
