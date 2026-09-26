namespace Samhallsinformation.Infrastructure.Auth;

using System.Text;
using Microsoft.IdentityModel.Tokens;

/// <summary>
/// Enda källan för JWT-hemligheten (E1#2). Program.cs (validering) och
/// <see cref="JwtTokenService"/> (signering) får samma instans via DI, så de
/// kan aldrig glida isär. Hemligheten läses på ETT ställe: <see cref="FromConfiguration"/>.
/// </summary>
public sealed class JwtSettings
{
    public const string ConfigKey = "JWT_SECRET";

    /// <summary>
    /// Dev-fallback som ENDAST används i Development. Utanför Development vägrar
    /// <see cref="StartupSecretsGuard"/> att starta appen om hemligheten saknas eller är exakt denna sträng.
    /// </summary>
    public const string DevFallbackSecret = "dev-secret-change-in-production-at-least-32-chars";

    public string Secret { get; }

    public JwtSettings(string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
            throw new ArgumentException("JWT-hemligheten får inte vara tom.", nameof(secret));
        Secret = secret;
    }

    /// <summary>
    /// Rått värde ur konfigurationen. WebApplication.CreateBuilder lägger redan miljövariabler i
    /// konfigurationen, så JWT_SECRET som env var hittas här. Null om saknas/tomt/bara blanksteg.
    /// </summary>
    public static string? ReadRawSecret(IConfiguration config)
    {
        var value = config[ConfigKey];
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    public static JwtSettings FromConfiguration(IConfiguration config, IHostEnvironment env)
    {
        var raw = ReadRawSecret(config);
        if (raw is not null)
            return new JwtSettings(raw);

        // Försvar på djupet: StartupSecretsGuard stoppar redan uppstarten, men fallbacken
        // får aldrig kunna nås i en icke-Development-miljö ens om vakten glömts.
        if (env.IsDevelopment())
            return new JwtSettings(DevFallbackSecret);

        throw new InvalidOperationException($"{ConfigKey} saknas (eller är tom) i miljön '{env.EnvironmentName}'.");
    }

    public SymmetricSecurityKey CreateSigningKey() => new(Encoding.UTF8.GetBytes(Secret));

    /// <summary>Validerings-parametrarna som JwtBearer använder — byggs härifrån så att de matchar signeringsnyckeln.</summary>
    public TokenValidationParameters CreateValidationParameters() => new()
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey         = CreateSigningKey(),
        ValidateIssuer           = false,
        ValidateAudience         = false,
        RoleClaimType            = "role",
    };
}
