namespace Samhallsinformation.Models;

public class User
{
    public Guid     Id           { get; set; } = Guid.NewGuid();
    public string   Email        { get; set; } = string.Empty;
    public string   PasswordHash { get; set; } = string.Empty;
    public string   Name         { get; set; } = string.Empty;
    public string   Role         { get; set; } = "Användare";
    public bool     PushEnabled  { get; set; } = true;
    public string   AuthProvider { get; set; } = "local";
    public bool     IsActive     { get; set; } = true;
    public DateTime? SuspendedAt     { get; set; }
    public string?   SuspendedReason { get; set; }
    public DateTime? SuspensionReminderAt   { get; set; }
    public string?   SuspensionReminderNote { get; set; }
    public DateTime? TermsAcceptedAt { get; set; }
    public DateTime? DeletedAt   { get; set; } // GDPR-radering — kontot anonymiseras i stället för att raderas fysiskt, se AdminUsersController.Delete
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;
}
