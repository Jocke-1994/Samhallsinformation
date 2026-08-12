namespace Samhallsinformation.Services;

public record GooglePayload(string Email, string Name);

public interface IGoogleTokenValidator
{
    // Returnerar null om token är ogiltig/utgången/fel audience — kastar aldrig.
    Task<GooglePayload?> ValidateAsync(string idToken);
}
