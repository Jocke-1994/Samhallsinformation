namespace Samhallsinformation.Models;

public class FaqItem
{
    public Guid     Id         { get; set; } = Guid.NewGuid();
    public string   Kategori   { get; set; } = "";
    public bool     Publicerad { get; set; } = true;
    public string   Fraga      { get; set; } = "";
    public string   Svar       { get; set; } = "";
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
}
