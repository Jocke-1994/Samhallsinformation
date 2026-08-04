namespace Samhallsinformation.Models;

public class FeatureIdeaChecklistItem
{
    public Guid     Id            { get; set; } = Guid.NewGuid();
    public Guid     FeatureIdeaId { get; set; }
    public string   Label         { get; set; } = string.Empty;
    public bool     Done          { get; set; } = false;
    public DateTime? DoneAt       { get; set; }
    public Guid?    DoneByUserId  { get; set; }

    public FeatureIdea Idea       { get; set; } = null!;
    public User?        DoneByUser { get; set; }
}
