namespace Samhallsinformation.Application.Aktivitetslogg;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

public class AktivitetsloggService : IAktivitetsloggService
{
    private readonly AppDbContext        _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AktivitetsloggService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(
        string aktörTyp,
        string typ,
        string rubrik,
        string detalj,
        string? gammaltVärde = null,
        string? nyttVärde = null,
        bool test = false,
        Guid? relateratÄrendeId = null)
    {
        var http = _httpContextAccessor.HttpContext;

        // System-händelser (registrering, ärende öppnat, m.fl.) har ingen
        // inloggad admin att slå upp — "System" är det avsedda värdet, inte
        // "Okänd" (som annars vore fallbacken för en oautentiserad förfrågan).
        var vem = aktörTyp == AktörTyper.System
            ? AktörTyper.System
            : http?.User.FindFirstValue("name") ?? http?.User.FindFirstValue(ClaimTypes.Email) ?? "Okänd";

        _db.AdminActivityLogs.Add(new AdminActivityLog
        {
            AktörTyp     = aktörTyp,
            Vem          = vem,
            Typ          = typ,
            Rubrik       = rubrik,
            Detalj       = detalj,
            GammaltVärde = gammaltVärde,
            NyttVärde    = nyttVärde,
            Test         = test,
            RelateratÄrendeId = relateratÄrendeId,
            Ip           = http?.Connection.RemoteIpAddress?.ToString(),
            Enhet        = http?.Request.Headers["User-Agent"].ToString(),
        });

        await _db.SaveChangesAsync();
    }
}
