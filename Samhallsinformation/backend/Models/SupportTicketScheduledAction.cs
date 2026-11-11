namespace Samhallsinformation.Models;

public class SupportTicketScheduledAction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public string Type { get; set; } = "svar";
    public DateTime ScheduledAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string? Text { get; set; }
    public Guid? ReassignToUserId { get; set; }
    public string? Instruction { get; set; }
    public bool Executed { get; set; } = false;
    public DateTime? ExecutedAt { get; set; }

    public SupportTicket Ticket { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public User? ReassignToUser { get; set; }
}
