namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-10 (beslut D1): Support-rollen når Support-inboxen, Användarlistan är skrivskyddad för
/// Support och allt övrigt i adminytan är Admin-only.
///
/// Behörigheten bevisas med ASP.NET Cores EGEN auktoriseringsmotor, inte med en egen tolkning av
/// attributen: för varje action byggs den kombinerade policyn av klass- + metodattributen
/// (<see cref="AuthorizationPolicy.CombineAsync"/>, flera [Authorize] ANDas) och utvärderas mot en
/// <see cref="ClaimsPrincipal"/> med rätt roll (<see cref="IAuthorizationService"/>) — samma steg som
/// authorization-middleware gör vid ett anrop.
/// </summary>
public class SupportRollBehorighetTests
{
    private static readonly ServiceProvider Tjänster = new ServiceCollection()
        .AddLogging()
        .AddAuthorization()
        .BuildServiceProvider();

    private static ClaimsPrincipal MedRoll(string roll) => new(new ClaimsIdentity(
        new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()), new Claim(ClaimTypes.Role, roll) }, "TestAuth"));

    private static ClaimsPrincipal Admin() => MedRoll(AdminRoller.Admin);
    private static ClaimsPrincipal Support() => MedRoll(AdminRoller.Support);
    private static ClaimsPrincipal Vanlig() => MedRoll("Användare");
    private static ClaimsPrincipal Anonym() => new(new ClaimsIdentity());

    private static IEnumerable<Type> Controllers() =>
        typeof(AdminSupportController).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t))
            .OrderBy(t => t.Name);

    private static IEnumerable<MethodInfo> Actions(Type controller) =>
        controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName
                        && !m.GetCustomAttributes<NonActionAttribute>().Any()
                        && m.GetCustomAttributes<HttpMethodAttribute>(inherit: true).Any());

    private static MethodInfo Action(Type controller, string name) =>
        Actions(controller).Single(m => m.Name == name);

    private static string Nyckel(MethodInfo m) => $"{m.DeclaringType!.Name}.{m.Name}";

    private static bool ÄrGet(MethodInfo m) =>
        m.GetCustomAttributes<HttpMethodAttribute>(inherit: true).All(a => a.HttpMethods.All(h => h == "GET"));

    // Rollstyrd = minst ett [Authorize(Roles = ...)] på klass eller metod. Skiljer "kräver en viss roll"
    // från "kräver bara inloggning" (t.ex. [Authorize] på användarens egna endpoints).
    private static bool ÄrRollstyrd(MethodInfo m) => AuthData(m).Any(a => !string.IsNullOrWhiteSpace(a.Roles));

    private static List<IAuthorizeData> AuthData(MethodInfo m) =>
        m.DeclaringType!.GetCustomAttributes(inherit: true).OfType<IAuthorizeData>()
            .Concat(m.GetCustomAttributes(inherit: true).OfType<IAuthorizeData>())
            .ToList();

    /// <summary>Släpper motorn igenom anropet? Anonyma actions (ingen policy) släpps igenom för alla.</summary>
    private static async Task<bool> Tillåter(MethodInfo m, ClaimsPrincipal user)
    {
        var attr = m.DeclaringType!.GetCustomAttributes(inherit: true).Concat(m.GetCustomAttributes(inherit: true)).ToList();
        if (attr.OfType<IAllowAnonymous>().Any()) return true;

        var policy = await AuthorizationPolicy.CombineAsync(
            Tjänster.GetRequiredService<IAuthorizationPolicyProvider>(), AuthData(m));
        if (policy == null) return true;

        var resultat = await Tjänster.GetRequiredService<IAuthorizationService>().AuthorizeAsync(user, policy);
        return resultat.Succeeded;
    }

    // --- Godkänd Support-yta ---------------------------------------------------------------------------

    private static readonly string[] SupportInbox =
    [
        nameof(AdminSupportController.GetAgents),
        nameof(AdminSupportController.GetTickets),
        nameof(AdminSupportController.GetTicket),
        nameof(AdminSupportController.Reply),
        nameof(AdminSupportController.SetStatus),
        nameof(AdminSupportController.SetArchived),
        nameof(AdminSupportController.Assign),
        nameof(AdminSupportController.SetReminder),
        nameof(AdminSupportController.AddScheduledAction),
        nameof(AdminSupportController.CancelScheduledAction),
        nameof(AdminSupportController.GetNotifications),
    ];

    private static readonly string[] AnvändareLäs =
    [
        nameof(AdminUsersController.GetUsers),
        nameof(AdminUsersController.Lookup),
    ];

    private static readonly string[] AnvändareSkriv =
    [
        nameof(AdminUsersController.SetStatus),
        nameof(AdminUsersController.Delete),
        nameof(AdminUsersController.CancelDeletion),
        nameof(AdminUsersController.SendPasswordReset),
        nameof(AdminUsersController.ResendVerification),
        nameof(AdminUsersController.GetNotifications), // spärr-påminnelser: admin-arbetsflöde, inte en användarläsning
    ];

    private static readonly string[] DetaljLäs =
    [
        nameof(AdminUserDetailsController.GetPolisenBevakningar),
        nameof(AdminUserDetailsController.GetUserSources),
        nameof(AdminUserDetailsController.GetSettingLog),
        nameof(AdminUserDetailsController.GetNotificationLog),
        nameof(AdminUserDetailsController.GetPushSettings),
        nameof(AdminUserDetailsController.GetSavedEvents),
        nameof(AdminUserDetailsController.ExplainEvent),
        nameof(AdminUserDetailsController.GetSavedEventsByEvent),
    ];

    private static readonly string[] DetaljSkriv =
    [
        nameof(AdminUserDetailsController.CreatePolisenBevakning),
        nameof(AdminUserDetailsController.UpdatePolisenBevakning),
        nameof(AdminUserDetailsController.DeletePolisenBevakning),
        nameof(AdminUserDetailsController.SetUserSourceActive),
        nameof(AdminUserDetailsController.SetPushSettings),
        nameof(AdminUserDetailsController.SaveEvent),
        nameof(AdminUserDetailsController.UnsaveEvent),
    ];

    private static readonly string[] Händelsesök =
    [
        nameof(AdminEventSearchController.Sources),
        nameof(AdminEventSearchController.Types),
        nameof(AdminEventSearchController.Search),
    ];

    /// <summary>Alla rollstyrda actions Support får nå — inget mer, inget mindre.</summary>
    private static readonly HashSet<string> GodkändSupportYta = new(
        SupportInbox.Select(a => $"{nameof(AdminSupportController)}.{a}")
        .Concat(AnvändareLäs.Select(a => $"{nameof(AdminUsersController)}.{a}"))
        .Concat(DetaljLäs.Select(a => $"{nameof(AdminUserDetailsController)}.{a}"))
        .Concat(Händelsesök.Select(a => $"{nameof(AdminEventSearchController)}.{a}"))
        // Loggar kontoåtgärder från Användare/Händelsesök; UI:t skickar bara typen Kontoåtgärd.
        .Append($"{nameof(AdminActivityLogController)}.{nameof(AdminActivityLogController.CreateLogEntry)}"));

    // --- Attributtest ----------------------------------------------------------------------------------

    [Fact]
    public void AdminRoller_MatchesLiteralRoleNames()
    {
        // Rollnamnen är kontraktet mot JWT:ns role-claim (User.Role) — får aldrig glida.
        Assert.Equal("Admin", AdminRoller.Admin);
        Assert.Equal("Support", AdminRoller.Support);
        Assert.Equal("Admin,Support", AdminRoller.AdminEllerSupport);
    }

    // --- Support-inbox: Support (och Admin) in, vanlig användare och anonym ut -------------------------

    [Fact]
    public void SupportInboxLista_TäckerHelaControllern()
    {
        // Fäller testet om någon lägger till en inbox-action utan att den hamnar i listan ovan.
        var faktiska = Actions(typeof(AdminSupportController)).Select(m => m.Name).OrderBy(n => n).ToArray();
        Assert.Equal(SupportInbox.OrderBy(n => n).ToArray(), faktiska);
    }

    [Theory]
    [MemberData(nameof(InboxActions))]
    public async Task Inbox_Support_TillåtsPåVarjeAction(string action)
    {
        Assert.True(await Tillåter(Action(typeof(AdminSupportController), action), Support()));
    }

    [Theory]
    [MemberData(nameof(InboxActions))]
    public async Task Inbox_Admin_ÄrOförändrat(string action)
    {
        Assert.True(await Tillåter(Action(typeof(AdminSupportController), action), Admin()));
    }

    [Theory]
    [MemberData(nameof(InboxActions))]
    public async Task Inbox_VanligAnvändareOchAnonym_Nekas(string action)
    {
        var m = Action(typeof(AdminSupportController), action);
        Assert.False(await Tillåter(m, Vanlig()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    public static IEnumerable<object[]> InboxActions() => SupportInbox.Select(a => new object[] { a });

    // --- Användare: läsa ja, skriva nej ----------------------------------------------------------------

    [Theory]
    [InlineData(nameof(AdminUsersController.GetUsers))]
    [InlineData(nameof(AdminUsersController.Lookup))]
    public async Task Användarlista_Läs_SupportOchAdminTillåts(string action)
    {
        var m = Action(typeof(AdminUsersController), action);
        Assert.True(await Tillåter(m, Support()));
        Assert.True(await Tillåter(m, Admin()));
        Assert.False(await Tillåter(m, Vanlig()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    [Theory]
    [InlineData(nameof(AdminUsersController.SetStatus))]
    [InlineData(nameof(AdminUsersController.Delete))]
    [InlineData(nameof(AdminUsersController.CancelDeletion))]
    [InlineData(nameof(AdminUsersController.SendPasswordReset))]
    [InlineData(nameof(AdminUsersController.ResendVerification))]
    [InlineData(nameof(AdminUsersController.GetNotifications))]
    public async Task Användarlista_SkrivOchAdminArbetsflöde_SupportFår403_AdminTillåts(string action)
    {
        var m = Action(typeof(AdminUsersController), action);
        Assert.False(await Tillåter(m, Support()));
        Assert.True(await Tillåter(m, Admin()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    [Fact]
    public void Användarlista_ListorTäckerHelaControllern()
    {
        var faktiska = Actions(typeof(AdminUsersController)).Select(m => m.Name).OrderBy(n => n).ToArray();
        Assert.Equal(AnvändareLäs.Concat(AnvändareSkriv).OrderBy(n => n).ToArray(), faktiska);
    }

    [Theory]
    [MemberData(nameof(DetaljLäsActions))]
    public async Task Användardetalj_Läs_SupportOchAdminTillåts(string action)
    {
        var m = Action(typeof(AdminUserDetailsController), action);
        Assert.True(await Tillåter(m, Support()));
        Assert.True(await Tillåter(m, Admin()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    [Theory]
    [MemberData(nameof(DetaljSkrivActions))]
    public async Task Användardetalj_Skriv_SupportFår403_AdminTillåts(string action)
    {
        var m = Action(typeof(AdminUserDetailsController), action);
        Assert.False(await Tillåter(m, Support()));
        Assert.True(await Tillåter(m, Admin()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    [Fact]
    public void Användardetalj_ListorTäckerHelaControllern()
    {
        var faktiska = Actions(typeof(AdminUserDetailsController)).Select(m => m.Name).OrderBy(n => n).ToArray();
        Assert.Equal(DetaljLäs.Concat(DetaljSkriv).OrderBy(n => n).ToArray(), faktiska);
    }

    public static IEnumerable<object[]> DetaljLäsActions() => DetaljLäs.Select(a => new object[] { a });
    public static IEnumerable<object[]> DetaljSkrivActions() => DetaljSkriv.Select(a => new object[] { a });

    // --- Händelsesök: läsning ja (skrivandet "Spara till användare" är ovan Admin-only) ----------------

    [Theory]
    [InlineData(nameof(AdminEventSearchController.Sources))]
    [InlineData(nameof(AdminEventSearchController.Types))]
    [InlineData(nameof(AdminEventSearchController.Search))]
    public async Task Händelsesök_SupportOchAdminTillåts(string action)
    {
        var m = Action(typeof(AdminEventSearchController), action);
        Assert.True(await Tillåter(m, Support()));
        Assert.True(await Tillåter(m, Admin()));
        Assert.False(await Tillåter(m, Anonym()));
    }

    // --- Allt övrigt förblir Admin-only ----------------------------------------------------------------

    [Theory]
    // Källhantering
    [InlineData(typeof(SourcesController), nameof(SourcesController.GetAdminSources))]
    [InlineData(typeof(SourcesController), nameof(SourcesController.CreateSource))]
    [InlineData(typeof(SourcesController), nameof(SourcesController.DeleteSource))]
    // Feature-flaggor
    [InlineData(typeof(FeatureFlagsController), nameof(FeatureFlagsController.SetOverride))]
    [InlineData(typeof(FeatureFlagsController), nameof(FeatureFlagsController.ResetOverrides))]
    // Sajtinställningar
    [InlineData(typeof(SiteSettingsController), nameof(SiteSettingsController.UpdateSiteSettings))]
    // Aktivitetslogg (läsning + ångra)
    [InlineData(typeof(AdminActivityLogController), nameof(AdminActivityLogController.GetLog))]
    [InlineData(typeof(AdminActivityLogController), nameof(AdminActivityLogController.MarkUndone))]
    // Felsökning / Larm / Rapporter
    [InlineData(typeof(AdminHealthController), "GetHealth")]
    [InlineData(typeof(AdminIngestorLogController), "GetSummary")]
    [InlineData(typeof(AdminAlertsController), "GetAlerts")]
    [InlineData(typeof(StatsController), "GetStats")]
    // Funktionsidéer, driftbanderoller
    [InlineData(typeof(AdminFeatureIdeaController), "GetIdeas")]
    [InlineData(typeof(MaintenanceBannersController), nameof(MaintenanceBannersController.Create))]
    public async Task ÖvrigAdminyta_SupportFår403_AdminTillåts(Type controller, string action)
    {
        var m = Action(controller, action);
        Assert.False(await Tillåter(m, Support()), $"{Nyckel(m)} ska vara Admin-only");
        Assert.True(await Tillåter(m, Admin()), $"{Nyckel(m)} ska vara öppen för Admin");
    }

    [Fact]
    public async Task Uppdateringar_Admin_SkrivåtgärderÄrAdminOnly()
    {
        var skrivande = Actions(typeof(UppdateringarController)).Where(m => !ÄrGet(m)).ToList();
        Assert.NotEmpty(skrivande);
        foreach (var m in skrivande)
        {
            Assert.False(await Tillåter(m, Support()), $"{Nyckel(m)} ska vara Admin-only");
            Assert.True(await Tillåter(m, Admin()), $"{Nyckel(m)} ska vara öppen för Admin");
        }
    }

    // --- Låsning av hela ytan --------------------------------------------------------------------------

    [Fact]
    public async Task SupportYtan_ÄrExaktDenGodkändaListan_IngenNyActionBlirÖppenAvMisstag()
    {
        var faktisk = new HashSet<string>();
        foreach (var c in Controllers())
            foreach (var m in Actions(c).Where(ÄrRollstyrd))
                if (await Tillåter(m, Support()))
                    faktisk.Add(Nyckel(m));

        var oväntade = faktisk.Except(GodkändSupportYta).OrderBy(x => x).ToList();
        var saknade = GodkändSupportYta.Except(faktisk).OrderBy(x => x).ToList();

        var problem = new List<string>();
        if (oväntade.Count > 0)
            problem.Add("Rollstyrda actions som Support når men som inte står på den godkända listan (gör dem Admin-only eller lägg till dem avsiktligt):\n  "
                + string.Join("\n  ", oväntade));
        if (saknade.Count > 0)
            problem.Add("Rader på den godkända listan som Support inte längre når:\n  " + string.Join("\n  ", saknade));
        Assert.True(problem.Count == 0, string.Join("\n\n", problem));
    }

    [Fact]
    public async Task SupportYtan_SkrivandeActionsUtanförInboxen_ÄrBaraLoggningen()
    {
        // D1: Användare/Händelsesök är skrivskyddade för Support. Den enda skrivande action utanför
        // Support-inboxen som Support når är att logga en kontoåtgärd.
        var skrivbara = new List<string>();
        foreach (var c in Controllers().Where(c => c != typeof(AdminSupportController)))
            foreach (var m in Actions(c).Where(m => ÄrRollstyrd(m) && !ÄrGet(m)))
                if (await Tillåter(m, Support()))
                    skrivbara.Add(Nyckel(m));

        Assert.Equal([$"{nameof(AdminActivityLogController)}.{nameof(AdminActivityLogController.CreateLogEntry)}"], skrivbara);
    }

    [Fact]
    public async Task VanligAnvändare_NårIngenRollstyrdAction()
    {
        foreach (var c in Controllers())
            foreach (var m in Actions(c).Where(ÄrRollstyrd))
                Assert.False(await Tillåter(m, Vanlig()), $"{Nyckel(m)} är rollstyrd men släpper in en vanlig användare");
    }

    [Fact]
    public async Task Admin_NårAllaRollstyrdaActions_Oförändrat()
    {
        foreach (var c in Controllers())
            foreach (var m in Actions(c).Where(ÄrRollstyrd))
                Assert.True(await Tillåter(m, Admin()), $"{Nyckel(m)} nekar Admin");
    }

    // --- Controller-anrop som Support: inboxen fungerar utan Admin-antaganden --------------------------

    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static AdminSupportController NyInbox(AppDbContext db, ClaimsPrincipal user, ISupportReplyDelivery? leverans = null) =>
        new(db, Substitute.For<IAktivitetsloggService>(), leverans ?? Substitute.For<ISupportReplyDelivery>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
        };

    private static (User supportAgent, ClaimsPrincipal principal) SkapaSupport(AppDbContext db)
    {
        var agent = new User { Name = "Sanna Support", Email = "sanna@example.com", PasswordHash = "x", Role = AdminRoller.Support };
        db.Users.Add(agent);
        db.SaveChanges();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, agent.Id.ToString()), new Claim(ClaimTypes.Role, AdminRoller.Support) }, "TestAuth"));
        return (agent, principal);
    }

    [Fact]
    public async Task Inbox_SupportAgent_KanListaOchÖppnaÄrenden()
    {
        using var db = NewDb();
        var (_, support) = SkapaSupport(db);
        var ärende = new SupportTicket { Subject = "Fråga", Category = "Konto", ContactEmail = "a@b.se" };
        db.SupportTickets.Add(ärende);
        await db.SaveChangesAsync();
        var controller = NyInbox(db, support);

        var lista = Assert.IsType<OkObjectResult>(await controller.GetTickets(null, null));
        Assert.Single(((System.Collections.IEnumerable)lista.Value!).Cast<object>());
        Assert.IsType<OkObjectResult>(await controller.GetTicket(ärende.Id));
        Assert.IsType<OkObjectResult>(await controller.GetAgents());
        Assert.IsType<OkObjectResult>(await controller.GetNotifications());
    }

    [Fact]
    public async Task Inbox_SupportAgent_KanSvaraMedEgetAnvändarIdSomAvsändare()
    {
        using var db = NewDb();
        var (agent, support) = SkapaSupport(db);
        var ärende = new SupportTicket { Subject = "Fråga", Category = "Konto" };
        db.SupportTickets.Add(ärende);
        await db.SaveChangesAsync();
        var leverans = Substitute.For<ISupportReplyDelivery>();
        var controller = NyInbox(db, support, leverans);

        var resultat = await controller.Reply(ärende.Id, new AgentReplyRequest("Hej, vi tittar på det.", false));

        Assert.IsType<OkResult>(resultat);
        await leverans.Received(1).DeliverAsync(Arg.Is<SupportReplyDeliveryRequest>(r =>
            r.Ticket.Id == ärende.Id && r.AuthorUserId == agent.Id && r.Text == "Hej, vi tittar på det."));
    }

    [Fact]
    public async Task Inbox_SupportAgent_KanTilldelaOchÄndraStatus()
    {
        using var db = NewDb();
        var (agent, support) = SkapaSupport(db);
        var ärende = new SupportTicket { Subject = "Fråga", Category = "Konto" };
        db.SupportTickets.Add(ärende);
        await db.SaveChangesAsync();
        var controller = NyInbox(db, support);

        Assert.IsType<OkResult>(await controller.Assign(ärende.Id, new AssignRequest(agent.Id)));
        Assert.IsType<OkResult>(await controller.SetStatus(ärende.Id, new SetStatusRequest("Under behandling")));

        var sparat = await db.SupportTickets.SingleAsync();
        Assert.Equal(agent.Id, sparat.AssignedToUserId);
        Assert.Equal("Under behandling", sparat.Status);
    }

    [Fact]
    public async Task Inbox_SupportAgent_NotisernaÄrSina_TilldeladTillMig()
    {
        using var db = NewDb();
        var (agent, support) = SkapaSupport(db);
        db.SupportTickets.Add(new SupportTicket { Subject = "Mitt ärende", Category = "Konto", AssignedToUserId = agent.Id });
        db.SupportTickets.Add(new SupportTicket { Subject = "Någon annans", Category = "Konto", AssignedToUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();
        var controller = NyInbox(db, support);

        var svar = Assert.IsType<OkObjectResult>(await controller.GetNotifications());

        Assert.Single(((System.Collections.IEnumerable)svar.Value!).Cast<object>());
    }
}
