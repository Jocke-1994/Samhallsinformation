namespace Samhallsinformation.Services;

using Google.Apis.Auth;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly string? _clientId;

    // Läses lazy (inte i konstruktorn) — IAuthService/AuthService injicerar den
    // här klassen för ALL inloggning, inte bara Google. Om vi kastar i
    // konstruktorn slutar vanlig e-post/lösenord-inloggning fungera lokalt
    // så fort GOOGLE_CLIENT_ID saknas i miljön.
    public GoogleTokenValidator(IConfiguration config)
    {
        _clientId = config["GOOGLE_CLIENT_ID"];
    }

    public async Task<GooglePayload?> ValidateAsync(string idToken)
    {
        if (string.IsNullOrEmpty(_clientId))
            return null;

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = [_clientId] };
            var payload  = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            return new GooglePayload(payload.Email, payload.Name ?? payload.Email, payload.EmailVerified);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }
}
