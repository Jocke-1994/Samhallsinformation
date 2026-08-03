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
    public DateTime CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt      { get; set; } = DateTime.UtcNow;

    public User?     CreatedByUser  { get; set; }
    public User?     AssignedToUser { get; set; }
}
