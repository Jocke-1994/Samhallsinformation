namespace Samhallsinformation.Application.Auth;

/// <summary>
/// Enda platsen för lösenordsregeln. Används av registrering, lösenordsbyte (ChangePasswordAsync)
/// och lösenordsåterställning. Frontendens text "Minst 8 tecken" ska följa <see cref="MinLength"/>.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    // Övre tak så att en absurt lång sträng inte skickas in i hashfunktionen (onödig CPU-kostnad).
    public const int MaxLength = 128;

    /// <summary>Returnerar ett felmeddelande på svenska, eller null om lösenordet uppfyller regeln.</summary>
    public static string? Validate(string? password)
    {
        if (password is null || password.Length < MinLength)
            return $"Lösenordet måste vara minst {MinLength} tecken";
        if (password.Length > MaxLength)
            return $"Lösenordet får vara högst {MaxLength} tecken";
        return null;
    }
}
