namespace Samhallsinformation.Services;

using System.Net;
using Samhallsinformation.Models;
using WebPush;

// Gränser för ett utskick. Standardvärdena gäller i produktion; tester skickar
// in små värden så timeouten går att provocera fram utan att vänta 10 sekunder.
public sealed record PushFanOutOptions(TimeSpan SendTimeout, int MaxParallelism)
{
    public static readonly PushFanOutOptions Default = new(TimeSpan.FromSeconds(10), 8);
}

// En enhet + det claimId dess push ska bära (null = ingen dedupe, t.ex. testpush).
public sealed record PushSendItem(UserDevice Device, Guid? ClaimId);

// Utfall per enhet. Status matchar NotificationDeliveryLog.Status.
public sealed record PushSendResult(UserDevice Device, string Status, string? ErrorMessage);

// Skickar en push till många enheter parallellt (begränsad grad), med egen
// timeout per enhet och full felisolering: ett fel eller en timeout på en enhet
// fäller aldrig de andra. Rör inte databasen — DbContext är inte trådsäker, så
// anroparen (PushDispatcher) loggar/städar utifrån resultaten efteråt.
public static class PushFanOut
{
    public static async Task<IReadOnlyList<PushSendResult>> SendAsync(
        IPushNotificationService push, IReadOnlyList<PushSendItem> items,
        string title, string body, string? url, PushFanOutOptions options, CancellationToken ct)
    {
        var results = new PushSendResult[items.Count];

        await Parallel.ForEachAsync(
            Enumerable.Range(0, items.Count),
            new ParallelOptions { MaxDegreeOfParallelism = options.MaxParallelism, CancellationToken = ct },
            async (i, token) => results[i] = await SendOneAsync(push, items[i], title, body, url, options.SendTimeout, token));

        return results;
    }

    private static async Task<PushSendResult> SendOneAsync(
        IPushNotificationService push, PushSendItem item,
        string title, string body, string? url, TimeSpan timeout, CancellationToken ct)
    {
        using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        Task? sendTask = null;
        try
        {
            sendTask = push.SendAsync(item.Device, title, body, url, item.ClaimId, sendCts.Token);
            // WaitAsync ger tillbaka kontrollen vid timeout även om implementationen
            // ignorerar sin token (en hängande socket); token-avbrottet nedan stänger
            // sedan det egentliga anropet så det inte ligger kvar i bakgrunden.
            await sendTask.WaitAsync(timeout, ct);
            return new PushSendResult(item.Device, "sent", null);
        }
        catch (TimeoutException)
        {
            sendCts.Cancel();
            // Den övergivna uppgiften kan fortfarande faila senare — observera felet
            // så det inte blir ett ohanterat undantag.
            _ = sendTask!.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted);
            return new PushSendResult(item.Device, "failed", $"Timeout efter {timeout.TotalSeconds:0.#} s");
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // Hela utskicket avbryts (t.ex. nedstängning) — inte ett enhetsfel.
        }
        catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            // Subskriptionen är död (webbläsaren har glömt den) — anroparen städar bort enheten.
            return new PushSendResult(item.Device, "expired", ex.Message);
        }
        catch (Exception ex)
        {
            return new PushSendResult(item.Device, "failed", ex.Message.Length > 500 ? ex.Message[..500] : ex.Message);
        }
    }
}
