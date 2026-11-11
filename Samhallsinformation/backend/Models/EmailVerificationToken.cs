namespace Samhallsinformation.Models;

public class EmailVerificationToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(48);
    public DateTime? UsedAt { get; set; }

    public User User { get; set; } = null!;
}
