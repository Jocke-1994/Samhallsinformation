namespace Samhallsinformation.Application.Auth;

public record AuthTokens(string AccessToken, string RefreshToken, string Name, string Role);

public class AuthResult
{
    public bool        Success    { get; }
    public int         StatusCode { get; }
    public string?      Error      { get; }
    public string?      Message    { get; }
    public AuthTokens?  Tokens     { get; }

    private AuthResult(bool success, int statusCode, string? error, string? message, AuthTokens? tokens)
    {
        Success    = success;
        StatusCode = statusCode;
        Error      = error;
        Message    = message;
        Tokens     = tokens;
    }

    public static AuthResult Ok(AuthTokens tokens) => new(true, 200, null, null, tokens);

    public static AuthResult Ok(string message) => new(true, 200, null, message, null);

    public static AuthResult Fail(int statusCode, string error) => new(false, statusCode, error, null, null);
}
