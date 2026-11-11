namespace Samhallsinformation.Models;

public class UserSettingAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Setting { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string ChangedBy { get; set; } = "user";
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
