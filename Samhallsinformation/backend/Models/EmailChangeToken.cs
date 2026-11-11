namespace Samhallsinformation.Models;

public class EmailChangeToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string NewEmail { get; set; } = string.Empty;
    public string Token { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
    public DateTime? UsedAt { get; set; }

    public User User { get; set; } = null!;
}
