namespace Samhallsinformation.Tests;

using Microsoft.Extensions.Logging;

/// <summary>Enkel ILogger som samlar alla loggposter (nivå, meddelande, undantag) så test kan kontrollera dem.</summary>
public class CapturingLogger : ILogger
{
    public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = new();

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter) =>
        Entries.Add((logLevel, formatter(state, exception), exception));

    public IEnumerable<string> Messages(LogLevel level) => Entries.Where(e => e.Level == level).Select(e => e.Message);
}

/// <summary>Typad variant för tjänster som tar ILogger&lt;T&gt;.</summary>
public sealed class CapturingLogger<T> : CapturingLogger, ILogger<T> { }
