namespace Samhallsinformation.Models;

public class Source
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Category { get; set; }
    public SourceType Type { get; set; }
    public bool IsActive { get; set; }
}