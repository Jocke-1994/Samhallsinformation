namespace Samhallsinformation.Models;

public class SupportTicket
{
    public Guid     Id             { get; set; } = Guid.NewGuid();
    public int      TicketNumber   { get; set; }
    public string   Subject        { get; set; } = string.Empty;
    public string   Category       { get; set; } = string.Empty;
    public string   Status         { get; set; } = "Öppet";
    public string   Channel        { get; set; } = "arendehantering";
    public Guid?    CreatedByUserId { get; set; }
    public string?  ContactName    { get; set; }
    public string?  ContactEmail   { get; set; }
    public Guid?    AssignedToUserId { get; set; }
    public DateTime? ReminderAt    { get; set; }
    public string?  ReminderNote   { get; set; }
    public bool     IsArchived     { get; set; } = false;
    public DateTime? FirstOpenedAt     { get; set; } // satt vid första GET av ärendedetaljer, ändras aldrig igen
    public DateTime? LastViewedAt      { get; set; } // satt vid VARJE GET av ärendedetaljer
    public DateTime? LastUserMessageAt { get; set; } // senaste medborgar-meddelandet (skapelse, svar, e-post). Oläst = detta > LastViewedAt
    public DateTime CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt      { get; set; } = DateTime.UtcNow;

    public User?     CreatedByUser  { get; set; }
    public User?     AssignedToUser { get; set; }
}
