namespace Samhallsinformation.Application.Auth;

/// <summary>
/// Kontobaserad spärr mot brute force / credential stuffing på inloggning (V2-10, E1 #1).
/// IP-räknaren (<c>auth</c>-policyn, 5/min/IP) stoppar en angripare från EN adress men inte en
/// som provar lösenord mot ETT konto från många IP-adresser. Den här räknar per normaliserad
/// e-postadress: högst <see cref="MaxAttempts"/> misslyckade försök per <see cref="Window"/>
/// (glidande fönster), sedan avvisas inloggning för adressen tills det äldsta misslyckandet
/// förfallit. En lyckad inloggning nollställer räknaren.
///
/// Räknaren nyckas på det angivna värdet oavsett om kontot finns, så svaret är identiskt för
/// känd och okänd adress (ingen kontoupptäckt).
///
/// Avvägning: den som känner en adress kan låsa ut ägaren i som mest <see cref="Window"/> (DoS mot
/// ett konto). Därför generöst tak (10, inte 3) och kort fönster; låset är tidsbegränsat och
/// aldrig permanent, så admin-/personalkonton kan inte låsas ut varaktigt. Försök som avvisas
/// förlänger inte låset.
///
/// Försöket bokförs redan i <see cref="TryAcquire"/>, före lösenordskontrollen (atomiskt — parallella
/// anrop kan inte alla slinka förbi taket) och tas bort igen av <see cref="Reset"/> vid lyckad
/// inloggning. Minnet: poster städas periodiskt när de förfallit, och antalet spårade adresser är
/// hårt begränsat. Registreras som singleton — räknaren är processlokal (in-memory), vilket räcker
/// för en enda backendinstans.
/// </summary>
public class LoginThrottle
{
    public const int MaxAttempts = 10;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    private const int MaxKeyLength   = 254;    // RFC 5321 — längre nycklar kan inte vara riktiga adresser
    private const int MaxTrackedKeys = 50_000; // minnestak; över det spåras inga nya adresser (IP-räknaren gäller ändå)
    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(1);

    private readonly TimeProvider _time;
    private readonly object _lock = new();
    private readonly Dictionary<string, Queue<DateTimeOffset>> _attempts = new();
    private DateTimeOffset _lastSweep;

    public LoginThrottle(TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;
        _lastSweep = _time.GetUtcNow();
    }

    /// <summary>Antal adresser som just nu spåras (för test/diagnostik).</summary>
    public int TrackedKeyCount { get { lock (_lock) return _attempts.Count; } }

    /// <summary>
    /// Bokför ett inloggningsförsök för adressen. Returnerar null om försöket får fortsätta, annars
    /// hur länge anroparen ska vänta (Retry-After). <paramref name="email"/> ska vara normaliserad
    /// med <see cref="EmailNormalizer"/>.
    /// </summary>
    public TimeSpan? TryAcquire(string email)
    {
        var key = KeyFor(email);
        var now = _time.GetUtcNow();

        lock (_lock)
        {
            SweepIfDue(now);

            if (!_attempts.TryGetValue(key, out var queue))
            {
                if (_attempts.Count >= MaxTrackedKeys)
                    return null; // fail-open för nya adresser i stället för obegränsad minnesväxt

                queue = new Queue<DateTimeOffset>();
                _attempts[key] = queue;
            }

            Prune(queue, now);

            if (queue.Count >= MaxAttempts)
            {
                var retryAfter = queue.Peek() + Window - now;
                return retryAfter > TimeSpan.Zero ? retryAfter : TimeSpan.FromSeconds(1);
            }

            queue.Enqueue(now);
            return null;
        }
    }

    /// <summary>Nollställer räknaren för adressen (lyckad inloggning).</summary>
    public void Reset(string email)
    {
        lock (_lock) _attempts.Remove(KeyFor(email));
    }

    private static string KeyFor(string email) =>
        email.Length > MaxKeyLength ? email[..MaxKeyLength] : email;

    private static void Prune(Queue<DateTimeOffset> queue, DateTimeOffset now)
    {
        while (queue.Count > 0 && now - queue.Peek() >= Window)
            queue.Dequeue();
    }

    private void SweepIfDue(DateTimeOffset now)
    {
        if (now - _lastSweep < SweepInterval) return;
        _lastSweep = now;

        List<string>? expired = null;
        foreach (var (key, queue) in _attempts)
        {
            Prune(queue, now);
            if (queue.Count == 0) (expired ??= new()).Add(key);
        }
        if (expired != null)
            foreach (var key in expired) _attempts.Remove(key);
    }
}
