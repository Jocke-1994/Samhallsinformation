namespace Samhallsinformation.Services;

// EmailVerified = Googles email_verified-claim. Utan den bevisar tokenet inte att adressen tillhör inloggaren.
public record GooglePayload(string Email, string Name, bool EmailVerified);

public interface IGoogleTokenValidator
{
    // Returnerar null om token är ogiltig/utgången/fel audience — kastar aldrig.
    Task<GooglePayload?> ValidateAsync(string idToken);
}
