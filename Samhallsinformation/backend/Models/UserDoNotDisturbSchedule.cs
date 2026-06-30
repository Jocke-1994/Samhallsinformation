namespace Samhallsinformation.Models;

public class UserDoNotDisturbSchedule
{
    public Guid   Id        { get; set; } = Guid.NewGuid();
    public Guid   UserId    { get; set; }
    public bool   IsEnabled { get; set; } = false;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime   { get; set; }

    public User User { get; set; } = null!;
}
