namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// E1#6 / V2-12: push-endpointen måste vara https + en känd push-tjänst, annars
// kan en registrerad användare få servern att POST:a mot godtyckliga adresser (blind SSRF).
public class PushEndpointValidatorTests
{
    [Theory]
    [InlineData("https://fcm.googleapis.com/fcm/send/abc123:APA91b")]
    [InlineData("https://fcm.googleapis.com:443/fcm/send/abc123")]
    [InlineData("https://android.googleapis.com/gcm/send/abc123")]
    [InlineData("https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB")]
    [InlineData("https://updates-autopush.stage.push.services.mozilla.com/wpush/v2/x")]
    [InlineData("https://web.push.apple.com/QGmNq0Ktv")]
    [InlineData("https://api.push.apple.com/3/device/abc")]
    [InlineData("https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB")]
    [InlineData("https://FCM.Googleapis.COM/fcm/send/abc")] // värdnamn är skiftlägesokänsliga
    public void GiltigaPushTjanster_Accepteras(string endpoint)
    {
        Assert.True(PushEndpointValidator.IsValid(endpoint));
    }

    [Theory]
    [InlineData("http://fcm.googleapis.com/fcm/send/abc")]                 // http
    [InlineData("https://localhost/x")]
    [InlineData("https://localhost:5000/x")]
    [InlineData("https://127.0.0.1/x")]
    [InlineData("https://169.254.169.254/latest/meta-data/")]              // moln-metadata
    [InlineData("https://10.0.0.5/x")]
    [InlineData("https://[::1]/x")]
    [InlineData("https://2130706433/x")]                                   // 127.0.0.1 som heltal
    [InlineData("https://fcm.googleapis.com.evil.com/x")]                  // suffix-trick
    [InlineData("https://evilfcm.googleapis.com.attacker.io/x")]
    [InlineData("https://notfcm.googleapis.com/x")]                        // fel etikettgräns
    [InlineData("https://evil-push.apple.com.evil.com/x")]
    [InlineData("https://xnotify.windows.com/x")]                          // "notify.windows.com" utan punkt före
    [InlineData("https://notify.windows.com/x")]                           // wildcard ska kräva underdomän
    [InlineData("https://evil.com/fcm.googleapis.com")]                    // känd värd i pathen
    [InlineData("https://evil.com/?u=https://fcm.googleapis.com/")]
    [InlineData("https://fcm.googleapis.com@evil.com/x")]                  // userinfo-trick
    [InlineData("https://user:pass@fcm.googleapis.com/x")]                 // userinfo
    [InlineData("https://evil.com\\@fcm.googleapis.com/x")]                // backslash-trick
    [InlineData("https://fcm.googleapis.com:8443/x")]                      // konstig port
    [InlineData("https://fcm.googleapis.com:80/x")]
    [InlineData("ftp://fcm.googleapis.com/x")]
    [InlineData("//fcm.googleapis.com/x")]                                 // protokollrelativ
    [InlineData("/fcm/send/abc")]                                          // relativ
    [InlineData("fcm.googleapis.com/fcm/send/abc")]                        // saknar schema
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData(" https://fcm.googleapis.com/x")]                          // blanktecken
    [InlineData("https://fcm.googleapis.com/x y")]
    public void OgiltigaEndpoints_Avvisas(string? endpoint)
    {
        Assert.False(PushEndpointValidator.IsValid(endpoint));
    }

    [Fact]
    public void ForLangUrl_Avvisas_MenGransvardetAccepteras()
    {
        const string prefix = "https://fcm.googleapis.com/";
        var exakt   = prefix + new string('a', PushEndpointValidator.MaxLength - prefix.Length);
        var forLang = exakt + "a";

        Assert.Equal(PushEndpointValidator.MaxLength, exakt.Length);
        Assert.True(PushEndpointValidator.IsValid(exakt));
        Assert.False(PushEndpointValidator.IsValid(forLang));
    }

    [Fact]
    public void ExtraHostsFranKonfiguration_LaggsTillStandardlistan()
    {
        var extra = PushEndpointValidator.ParseExtraHosts("push.example.org, *.push.example.net");

        Assert.True(PushEndpointValidator.IsValid("https://push.example.org/x", extra));
        Assert.True(PushEndpointValidator.IsValid("https://a.push.example.net/x", extra));
        Assert.False(PushEndpointValidator.IsValid("https://push.example.org.evil.com/x", extra));
        Assert.False(PushEndpointValidator.IsValid("https://push.example.org/x")); // utan extra: avvisas
        Assert.True(PushEndpointValidator.IsValid("https://fcm.googleapis.com/x", extra)); // standardlistan finns kvar
    }

    [Fact]
    public void ParseExtraHosts_TomEllerNull_GerTomLista()
    {
        Assert.Empty(PushEndpointValidator.ParseExtraHosts(null));
        Assert.Empty(PushEndpointValidator.ParseExtraHosts(""));
        Assert.Empty(PushEndpointValidator.ParseExtraHosts("  "));
    }
}

public class PushSubscribeEndpointValidationTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static PushController NewController(AppDbContext db, Guid userId)
    {
        var controller = new PushController(
            db, Substitute.For<IConfiguration>(),
            Substitute.For<IPushNotificationService>(), Substitute.For<IAktivitetsloggService>());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "test"))
            }
        };
        return controller;
    }

    private static SubscribeRequest Req(string endpoint) =>
        new(endpoint, new SubscribeKeys("p256dh-nyckel", "auth-hemlighet"), "Min telefon", "android");

    [Theory]
    [InlineData("http://169.254.169.254/latest/meta-data/")]
    [InlineData("https://interna-tjansten/x")]
    [InlineData("https://fcm.googleapis.com.evil.com/x")]
    [InlineData("https://evil.com/fcm.googleapis.com")]
    [InlineData("")]
    public async Task Subscribe_OgiltigEndpoint_Ger400_OchSpararInget(string endpoint)
    {
        using var db = NewDb();
        var controller = NewController(db, Guid.NewGuid());

        var result = await controller.Subscribe(Req(endpoint));

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var error = bad.Value!.GetType().GetProperty("error")!.GetValue(bad.Value) as string;
        Assert.False(string.IsNullOrWhiteSpace(error));
        Assert.Empty(await db.UserDevices.ToListAsync());
    }

    [Fact]
    public async Task Subscribe_GiltigFcmEndpoint_Sparas()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var controller = NewController(db, userId);

        var result = await controller.Subscribe(Req("https://fcm.googleapis.com/fcm/send/abc123"));

        Assert.IsType<OkResult>(result);
        var device = await db.UserDevices.SingleAsync();
        Assert.Equal(userId, device.UserId);
        Assert.Equal("https://fcm.googleapis.com/fcm/send/abc123", device.Endpoint);
    }

    [Fact]
    public async Task Subscribe_OgiltigEndpoint_KanInteOverskrivaBefintligPrenumeration()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        db.UserDevices.Add(new UserDevice { UserId = userId, Endpoint = "https://fcm.googleapis.com/fcm/send/abc", P256dh = "a", Auth = "b" });
        await db.SaveChangesAsync();
        var controller = NewController(db, userId);

        var result = await controller.Subscribe(Req("http://evil.internal/x"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("https://fcm.googleapis.com/fcm/send/abc", (await db.UserDevices.SingleAsync()).Endpoint);
    }
}

public class WebPushNotificationServiceEndpointGuardTests
{
    // Prenumerationer sparade innan valideringen infördes får inte ge ett utgående anrop.
    [Fact]
    public async Task SendAsync_OgiltigEndpoint_BlockerasUtanUtgaendeAnrop()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["VAPID_PUBLIC_KEY"]  = "x",
            ["VAPID_PRIVATE_KEY"] = "y",
        }).Build();
        using var service = new WebPushNotificationService(config);
        var device = new UserDevice { Endpoint = "http://169.254.169.254/latest/meta-data/", P256dh = "a", Auth = "b" };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.SendAsync(device, "t", "b", null));

        Assert.Contains("blockerat", ex.Message);
    }
}
