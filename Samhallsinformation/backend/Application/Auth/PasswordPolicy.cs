namespace Samhallsinformation.Application.Auth;

/// <summary>
/// Enda platsen för lösenordsregeln. Används av lösenordsbyte (ChangePasswordAsync) och
/// lösenordsåterställning; registrering ska återanvända den när den skärps (V2-11).
/// Frontendens text "Minst 8 tecken" ska följa <see cref="MinLength"/>.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    /// <summary>Returnerar ett felmeddelande på svenska, eller null om lösenordet uppfyller regeln.</summary>
    public static string? Validate(string? password) =>
        password is null || password.Length < MinLength
            ? $"Lösenordet måste vara minst {MinLength} tecken"
            : null;
}
