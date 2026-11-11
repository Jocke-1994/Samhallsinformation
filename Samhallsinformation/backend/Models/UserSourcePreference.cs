namespace Samhallsinformation.Models;

public class UserSourcePreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public int SourceId { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public User User { get; set; } = null!;
    public Source Source { get; set; } = null!;
}
