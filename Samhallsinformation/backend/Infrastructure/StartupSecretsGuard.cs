namespace Samhallsinformation.Infrastructure;

using System.Security.Cryptography;
using System.Text;
using Samhallsinformation.Infrastructure.Auth;
using WebPush;

/// <summary>
/// Fail-fast för hemligheter (E1#2). Utanför Development ska appen inte starta tyst med
/// hårdkodade fallback-hemligheter — den ska vägra starta med ett tydligt fel.
/// Meddelandena nämner bara VILKEN variabel som är fel, aldrig något värde.
/// I Development behålls fallbackar så att lokal körning fungerar.
/// </summary>
public static class StartupSecretsGuard
{
    public const string VapidPublicKeyConfig  = "VAPID_PUBLIC_KEY";
    public const string VapidPrivateKeyConfig = "VAPID_PRIVATE_KEY";

    /// <summary>Under detta antal tecken loggas en Warning (ingen tvingad minimilängd — produktionens längd är okänd).</summary>
    public const int RecommendedJwtSecretLength = 32;

    // Den tidigare hårdkodade dev-VAPID-nyckeln. Den publika delen är ingen hemlighet; den privata
    // finns inte längre i källkoden utan känns igen via SHA-256 så att ett par som råkat kopieras
    // in i en miljö ändå avvisas.
    internal const string FormerDevVapidPublicKey = "BK2R_L5jWNIL18xz26s9jNiZ3wh5utgTgjjzaLUlXDcT55R2UPSm36Qn5t0LmQLbeUUoNzDsRXEFDy5qqOW7wRk";
    private const string FormerDevVapidPrivateKeySha256 = "3b96bc1caf859afe8937c7c09ae9c0dfb541dd528fdd30e3d8ab1ce6f6f84e8c";

    /// <summary>
    /// Kastar <see cref="InvalidOperationException"/> utanför Development om JWT_SECRET eller VAPID-nycklarna
    /// saknas, är tomma eller är de kända dev-värdena. Loggar en Warning om JWT_SECRET är kortare än 32 tecken.
    /// </summary>
    public static void Validate(IConfiguration config, IHostEnvironment env, ILogger? logger = null)
    {
        var jwt = JwtSettings.ReadRawSecret(config);
        if (jwt is not null && jwt.Length < RecommendedJwtSecretLength)
            logger?.LogWarning(
                "{Key} är kortare än {Min} tecken ({Length} tecken). Det fungerar, men en längre slumpmässig hemlighet rekommenderas.",
                JwtSettings.ConfigKey, RecommendedJwtSecretLength, jwt.Length);

        if (env.IsDevelopment())
            return;

        var problems = new List<string>();

        if (jwt is null)
            problems.Add($"{JwtSettings.ConfigKey} saknas eller är tom");
        else if (string.Equals(jwt, JwtSettings.DevFallbackSecret, StringComparison.Ordinal))
            problems.Add($"{JwtSettings.ConfigKey} har utvecklingsvärdet (den hårdkodade dev-hemligheten)");

        var vapidPublic  = config[VapidPublicKeyConfig];
        var vapidPrivate = config[VapidPrivateKeyConfig];

        if (string.IsNullOrWhiteSpace(vapidPublic))
            problems.Add($"{VapidPublicKeyConfig} saknas eller är tom");
        else if (string.Equals(vapidPublic.Trim(), FormerDevVapidPublicKey, StringComparison.Ordinal))
            problems.Add($"{VapidPublicKeyConfig} har utvecklingsvärdet (det tidigare hårdkodade dev-paret)");

        if (string.IsNullOrWhiteSpace(vapidPrivate))
            problems.Add($"{VapidPrivateKeyConfig} saknas eller är tom");
        else if (IsFormerDevVapidPrivateKey(vapidPrivate))
            problems.Add($"{VapidPrivateKeyConfig} har utvecklingsvärdet (det tidigare hårdkodade dev-paret)");

        if (problems.Count > 0)
            throw new InvalidOperationException(
                $"Uppstart avbruten i miljön '{env.EnvironmentName}': " +
                string.Join("; ", problems) +
                ". Sätt riktiga värden som miljövariabler.");
    }

    /// <summary>
    /// Endast Development: genererar ett nytt VAPID-nyckelpar om någon av nycklarna saknas, så att inget
    /// privat nyckelmaterial behöver ligga i repot. Push-prenumerationer överlever inte en omstart då.
    /// No-op utanför Development.
    /// </summary>
    public static void ApplyDevelopmentFallbacks(IConfiguration config, IHostEnvironment env, ILogger? logger = null)
    {
        if (!env.IsDevelopment())
            return;

        if (!string.IsNullOrWhiteSpace(config[VapidPublicKeyConfig]) &&
            !string.IsNullOrWhiteSpace(config[VapidPrivateKeyConfig]))
            return;

        var keys = VapidHelper.GenerateVapidKeys();
        config[VapidPublicKeyConfig]  = keys.PublicKey;
        config[VapidPrivateKeyConfig] = keys.PrivateKey;

        logger?.LogWarning(
            "{Public}/{Private} saknas i Development: ett nytt VAPID-nyckelpar genererades för den här körningen. " +
            "Push-prenumerationer som skapats tidigare slutar fungera vid varje omstart.",
            VapidPublicKeyConfig, VapidPrivateKeyConfig);
    }

    internal static bool IsFormerDevVapidPrivateKey(string value)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim()))).ToLowerInvariant();
        return hash == FormerDevVapidPrivateKeySha256;
    }
}
