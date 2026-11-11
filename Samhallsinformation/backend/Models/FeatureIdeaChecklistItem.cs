namespace Samhallsinformation.Models;

public class FeatureIdeaChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FeatureIdeaId { get; set; }
    // "lansering" (den redan existerande Lanseringschecklistan, auto-seedad vid
    // stadiet "lanseringsklar") eller "testning" (nya Manuella tester-listan
    // under Testchecklistan, manuellt ifylld — se AdminFeatureIdeaController).
    public string Fas { get; set; } = "lansering";
    public string Label { get; set; } = string.Empty;
    public bool Done { get; set; } = false;
    public DateTime? DoneAt { get; set; }
    public Guid? DoneByUserId { get; set; }

    public FeatureIdea Idea { get; set; } = null!;
    public User? DoneByUser { get; set; }
}
