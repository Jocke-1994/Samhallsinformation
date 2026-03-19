namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

[ApiController]
[Route("api/[controller]")]
public class SourcesController : ControllerBase
{
    private readonly AppDbContext _db;

    public SourcesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetSources()
    {
        var sources = await _db.Sources.ToListAsync();
        return Ok(sources);
    }
}
