namespace Samhallsinformation.Models;

public class FeatureIdea
{
    public Guid     Id               { get; set; } = Guid.NewGuid();
    public int      IdeaNumber       { get; set; }
    public string   Title            { get; set; } = string.Empty;
    public string   Description      { get; set; } = string.Empty;
    public string   Stage            { get; set; } = "brainstorm";
    public bool?    TriageKanGoras   { get; set; }
    public bool?    TriageBorGoras   { get; set; }
    public string?  TriageMotivering { get; set; }
    public string   KällaTyp         { get; set; } = "admin";
    public Guid?    SourceTicketId   { get; set; }
    public string?  FlagKey          { get; set; }
    public Guid     CreatedByUserId  { get; set; }
    public DateTime CreatedAt        { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt        { get; set; } = DateTime.UtcNow;

    public SupportTicket? SourceTicket  { get; set; }
    public User            CreatedByUser { get; set; } = null!;
}
