namespace Samhallsinformation.Tests;

using System.Text.Json;
using Xunit;

// Vad en händelse får visa utåt (#729), delat av alla tester för endpoints som
// skickar händelser: /api/events, /api/user/feed, /api/user/saved-events/events
// och /api/platser/handelser.
internal static class EventFaltVitlista
{
    // Exakt de fält frontend läser (CanonicalEvent i frontend/src/types/index.ts).
    // Ett nytt fält i databasmodellen ska INTE synas utåt förrän någon lägger till det här.
    public static readonly string[] TillatnaEventFalt =
        ["content", "eventType", "geography", "id", "isNational", "publishedAt", "severity", "sourceId", "title", "url"];

    // Samma JSON-inställningar som ASP.NET Core använder för svaren (camelCase).
    private static readonly JsonSerializerOptions Webb = new(JsonSerializerDefaults.Web);

    public static JsonElement TillJson(object value) =>
        JsonDocument.Parse(JsonSerializer.Serialize(value, Webb)).RootElement.Clone();

    public static void AssertEndastTillatnaFalt(object value) => AssertEndastTillatnaFalt(TillJson(value));

    public static void AssertEndastTillatnaFalt(JsonElement händelse)
    {
        var falt = händelse.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();
        var forMycket = falt.Except(TillatnaEventFalt).ToArray();
        var saknas = TillatnaEventFalt.Except(falt).ToArray();
        Assert.True(forMycket.Length == 0, $"Fält som inte får gå ut: {string.Join(", ", forMycket)}");
        Assert.True(saknas.Length == 0, $"Fält som frontend behöver men saknas: {string.Join(", ", saknas)}");
    }
}
