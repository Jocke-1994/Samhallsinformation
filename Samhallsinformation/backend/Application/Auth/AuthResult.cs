namespace Samhallsinformation.Application.Auth;

public record AuthTokens(string AccessToken, string RefreshToken, string Name, string Role, bool IsNewUser = false);

public class AuthResult
{
    public bool Success { get; }
    public int StatusCode { get; }
    public string? Error { get; }
    public string? Message { get; }
    public AuthTokens? Tokens { get; }
    /// <summary>Sätts endast vid 429 från kontospärren — controllern skickar det som Retry-After.</summary>
    public TimeSpan? RetryAfter { get; private init; }

    private AuthResult(bool success, int statusCode, string? error, string? message, AuthTokens? tokens)
    {
        Success = success;
        StatusCode = statusCode;
        Error = error;
        Message = message;
        Tokens = tokens;
    }

    public static AuthResult Ok(AuthTokens tokens) => new(true, 200, null, null, tokens);

    public static AuthResult Ok(string message) => new(true, 200, null, message, null);

    public static AuthResult Fail(int statusCode, string error) => new(false, statusCode, error, null, null);

    public static AuthResult TooManyAttempts(string error, TimeSpan retryAfter) =>
        new(false, 429, error, null, null) { RetryAfter = retryAfter };
}
