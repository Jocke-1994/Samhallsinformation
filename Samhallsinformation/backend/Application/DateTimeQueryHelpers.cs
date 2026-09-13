namespace Samhallsinformation.Application;

public static class DateTimeQueryHelpers
{
    // Npgsql (6+) kastar "Cannot write DateTime with Kind=Unspecified to
    // PostgreSQL type 'timestamp with time zone'" om ett DateTime med
    // Kind=Unspecified/Local jämförs mot en timestamptz-kolumn (t.ex.
    // Events.PublishedAt). En [FromQuery] DateTime? bunden från en sträng
    // UTAN "Z" (t.ex. "2026-09-13" eller "2026-09-13T00:00:00") binds med
    // Kind=Unspecified — kraschar bara mot Postgres, aldrig mot SQLite
    // lokalt, vilket gjorde det osynligt tills en extern konsument (utan
    // kontroll över exakt strängformat) hittade det live 2026-09-13.
    // Våra egna PublishedAt-värden är alltid UTC, så det är korrekt att
    // tolka en ospecificerad Kind som redan-UTC snarare än att avvisa den.
    public static DateTime EnsureUtcKind(DateTime dt) =>
        dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
}
