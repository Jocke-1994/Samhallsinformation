namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Samhallsinformation.Application.Dev;

// Utvecklingsnära admin-verktyg som inte hör hemma i en specifik domän-
// controller. Just nu bara testkatalogen (Funktionsidéernas "Automatiska
// tester" söker härifrån) — se Application/Dev/TestCatalog.cs för hur
// katalogfilen genereras och varför den inte kan läsas live i produktion.
[ApiController]
[Route("api/admin/dev")]
[Authorize(Roles = "Admin")]
public class AdminDevController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public AdminDevController(IWebHostEnvironment env) => _env = env;

    [HttpGet("test-catalog")]
    public IActionResult SearchCatalog([FromQuery] string? search)
    {
        var catalog = TestCatalog.Load(_env.ContentRootPath);
        var träffar = TestCatalog.Search(catalog, search)
            .Select(f => new { f.Path, f.ClassName, f.Project, f.Count, f.Names })
            .Take(30)
            .ToList();

        return Ok(new { catalog.GeneratedAt, catalog.BackendTotal, catalog.FrontendTotal, Files = träffar });
    }
}
