namespace Samhallsinformation.Models;

public class UserNotificationSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public int SourceId { get; set; }
    public bool PushEnabled { get; set; } = false;
    public bool EmailEnabled { get; set; } = false;
    public bool SmsEnabled { get; set; } = false;

    public User User { get; set; } = null!;
    public Source Source { get; set; } = null!;
}
