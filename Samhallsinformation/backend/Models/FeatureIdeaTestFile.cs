namespace Samhallsinformation.Models;

// En koppling mellan en funktionsidé och en riktig testfil i kodbasen (t.ex.
// "backend.Tests/PlatsMatchareTests.cs") — admin söker och väljer bland
// filerna i backend/Data/test-catalog.json, FilePath är alltid en sökväg
// som faktiskt finns där, aldrig fri text. Visas som "Automatiska tester" i
// Testchecklistan (AdminFeatureIdeaController.GetIdea slår upp antal/namn
// mot katalogen vid varje hämtning, så antalet alltid är aktuellt).
public class FeatureIdeaTestFile
{
    public Guid     Id            { get; set; } = Guid.NewGuid();
    public Guid     FeatureIdeaId { get; set; }
    public string   FilePath      { get; set; } = string.Empty;
    public DateTime AddedAt       { get; set; } = DateTime.UtcNow;

    public FeatureIdea Idea { get; set; } = null!;
}
