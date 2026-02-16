namespace Samhallsinformation.Models;

public class UserPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public string? GeographyFilter { get; set; }
    public string? SourceFilter { get; set; }
    public string? SeverityFilter { get; set; }
    public bool IsActive { get; set; } = true;
}
