namespace Samhallsinformation.Models;

public class FeatureIdeaTester
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FeatureIdeaId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public FeatureIdea Idea { get; set; } = null!;
    public User User { get; set; } = null!;
}
