namespace Samhallsinformation.Models;

public class SupportTicketMessage
{
    public Guid     Id           { get; set; } = Guid.NewGuid();
    public Guid     TicketId     { get; set; }
    public string   SenderType   { get; set; } = "user";
    public Guid?    AuthorUserId { get; set; }
    public string   Text         { get; set; } = string.Empty;
    public bool     IsInternal   { get; set; } = false;
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;

    public SupportTicket Ticket { get; set; } = null!;
    public User?          AuthorUser { get; set; }
}
