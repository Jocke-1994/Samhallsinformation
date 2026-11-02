namespace Samhallsinformation.Models;

public class User
{
    public Guid     Id           { get; set; } = Guid.NewGuid();
    public string   Email        { get; set; } = string.Empty;
    public string   PasswordHash { get; set; } = string.Empty;
    public string   Name         { get; set; } = string.Empty;
    public string?  DisplayName  { get; set; } // Visas istället för "Support" i supportsvar till slutanvändare — avslöjar aldrig riktiga Name
    public string   Role         { get; set; } = "Användare";
    public bool     PushEnabled  { get; set; } = true; // Global mute för admin/support-egna driftnotiser (nytt ärende/ny användare) — orört av kategorierna nedan
    public bool     PushNyaHandelser { get; set; } = true; // "Ny händelse"-kategorin i Konto → Push-notiser (källorna i Mitt flöde)
    public bool     PushNyVersion    { get; set; } = true; // "Ny version"-kategorin i Konto → Push-notiser
    public string   AuthProvider { get; set; } = "local";
    public bool     IsActive     { get; set; } = true;
    public DateTime? SuspendedAt     { get; set; }
    public string?   SuspendedReason { get; set; }
    public DateTime? SuspensionReminderAt   { get; set; }
    public string?   SuspensionReminderNote { get; set; }
    public DateTime? TermsAcceptedAt { get; set; }
    public DateTime? DeletedAt            { get; set; } // GDPR-radering — kontot anonymiseras i stället för att raderas fysiskt, se UserDeletionBackgroundService
    public DateTime? DeletionScheduledAt  { get; set; } // 24h ångerfönster — satt av AdminUsersController.Delete, körs av UserDeletionBackgroundService
    public string?   DeletionCancelToken  { get; set; } // Engångslänk skickad när raderingen begärs — bevisar identitet utan inloggning, se AuthController.CancelDeletion
    public bool     EmailVerified { get; set; } = false;
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;
    public Guid?    VadArNyttSettId { get; set; } // Senaste Uppdatering användaren stängt Vad är nytt-rutan för — på kontot, inte i webbläsaren, så rutan inte dyker upp igen på en annan enhet
}
