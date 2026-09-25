namespace Samhallsinformation.Tests;

using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Samhallsinformation.Controllers;
using Xunit;

/// <summary>
/// Guard G4 (code review enhet 8): baslinje över den publika ytan. Reflektion listar varje
/// action som är nåbar UTAN inloggning och jämför mot <see cref="Approved"/>. Testet fallerar
/// åt båda håll: en ny anonym endpoint som inte står på listan (ingen ny endpoint blir öppen av
/// misstag), och en rad på listan som inte längre finns (listan ruttnar inte).
///
/// "Anonym" = ingen <c>[Authorize]</c> på varken klass eller metod, ELLER <c>[AllowAnonymous]</c>
/// på klass/metod (AllowAnonymous vinner över Authorize i ASP.NET Core). Appen har ingen
/// FallbackPolicy (<c>AddAuthorization()</c> utan policy) och inga minimal-API-endpoints, så
/// controller-attributen är hela sanningen. Om någon inför en FallbackPolicy måste testet ses över.
///
/// Att lägga till en anonym endpoint kräver alltså en avsiktlig rad + motivering här.
/// </summary>
public class AnonymousEndpointsGuardTests
{
    private sealed record Anon(string Controller, string Action, string Http, string Why);

    // Format: controller + action + HTTP-metod + motivering. Sorterad per controller.
    private static readonly Anon[] Approved =
    [
        // --- Auth: login/registrering/återställning (rate limit-policyn "auth" ligger på hela AuthController) ---
        new("AuthController", "Login",              "POST", "Inloggning — kan per definition inte kräva inloggning."),
        new("AuthController", "Register",           "POST", "Registrering — kan per definition inte kräva inloggning."),
        new("AuthController", "Google",             "POST", "Google-inloggning/-registrering; Googles ID-token verifieras i AuthService."),
        new("AuthController", "Refresh",            "POST", "Byter refresh-token mot ny access-token; refresh-token i bodyn ÄR autentiseringen (access-token har ofta gått ut)."),
        new("AuthController", "Logout",             "POST", "Återkallar refresh-token; refresh-token i bodyn är autentiseringen, funkar även med utgången access-token."),
        new("AuthController", "ForgotPassword",     "POST", "Begär lösenordsåterställning; svarar likadant oavsett om adressen finns."),
        new("AuthController", "ResetPassword",      "POST", "Löser in engångstoken från mejl; token är autentiseringen."),
        new("AuthController", "VerifyEmail",        "POST", "Löser in engångstoken från verifieringsmejl (klickas ofta i annan webbläsare/enhet än den inloggade)."),
        new("AuthController", "ConfirmEmailChange", "POST", "Löser in engångstoken skickad till NYA adressen; token är autentiseringen."),
        new("AuthController", "CancelDeletion",     "POST", "Ångra GDPR-radering via engångslänk i mejl; länken bevisar identitet (kontot är spärrat och kan inte logga in)."),

        // --- Publik läsning (medborgarflödet, ingen inloggning krävs) ---
        new("EventsController", "GetEvents",        "GET",  "Publikt händelseflöde; filtrerar på publicerade källor."),
        new("EventsController", "SearchPublic",     "GET",  "Publik sök för kundtjänstboten; bara publicerade källor, egen rate limit-policy."),
        new("FaqController", "GetFaq",              "GET",  "Publik FAQ; bara publicerade poster, filtrerade på feature-flaggor."),
        new("FeatureFlagsController", "GetOverrides", "GET", "Globalt flaggtillstånd som alla besökare behöver; innehåller bara admins avvikelser från kodens default."),
        new("MaintenanceBannersController", "GetAll", "GET", "Driftbanderoll som visas för alla besökare."),
        new("SiteSettingsController", "GetSiteSettings", "GET", "Globala sajtinställningar (visa Logga in/Skapa konto-knappar) som utloggade besökare behöver."),
        new("SourcesController", "GetSources",      "GET",  "Publik källista i sidomenyn; bara publicerade källor."),
        new("UppdateringarController", "GetUppdateringar", "GET", "Publik changelog/Nyheter; bara publicerade poster."),
        new("PushController", "GetPublicKey",       "GET",  "Publik VAPID-nyckel som webbläsaren behöver för pushManager.subscribe() (publik per design)."),

        // --- Publik skrivning / tjänst-till-tjänst ---
        new("EventsController", "LogShare",         "POST", "Analytics vid klick på Dela (ska funka utloggad). Saknar validering av att händelsen finns och rate limit, se enhet-1 obs. (Publika endpoints)."),
        new("PushController", "Claim",              "POST", "Service workern har inte pålitligt en färsk JWT; slumpad engångs-Guid är spärren. Ingen rate limit, se enhet-1 obs. och enhet-3 #4."),
        new("SupportController", "Create",          "POST", "Feedback/ärende från utloggade besökare (Hjälp & Feedback-knappen). Saknar rate limit och längdgränser, se enhet-1 #8."),
        new("WebhooksController", "ResendInbound",  "POST", "Resend inbound-webhook; skyddas av svix-signaturverifiering i metoden, inte av JWT. Hårdgörs i V1-2 (enhet-1 #5/#10)."),

        // --- MISSTÄNKT: ser oavsiktligt öppna ut. Ändras INTE i den här PR:en ---
        new("EventsController", "GetEvent",         "GET",  "MISSTÄNKT — se enhet-1 obs. (Publika endpoints): saknar IsPublished-filter (till skillnad från GetEvents/SearchPublic), läcker händelser från opublicerade sandlådekällor om man har id:t."),
        new("EventsController", "GetLinkStatus",    "GET",  "MISSTÄNKT — se enhet-1 obs. (Publika endpoints): anonym utan rate limit, gör utgående GET per anrop och saknar IsPublished-filter. Anonymt är avsiktligt för utloggade läsare, skyddet saknas."),

        // --- KÄNT HÅL — tas bort i V1-3 (E1 #4). Ta bort raderna då. ---
        new("PreferencesController", "GetPreferences",   "GET",    "KÄNT HÅL — tas bort i V1-3, ta bort raderna då (E1 #4): saknar auth och ägarkontroll, oanvänd av frontend."),
        new("PreferencesController", "CreatePreference", "POST",   "KÄNT HÅL — tas bort i V1-3, ta bort raderna då (E1 #4)."),
        new("PreferencesController", "UpdatePreference", "PUT",    "KÄNT HÅL — tas bort i V1-3, ta bort raderna då (E1 #4)."),
        new("PreferencesController", "DeletePreference", "DELETE", "KÄNT HÅL — tas bort i V1-3, ta bort raderna då (E1 #4)."),
    ];

    private static string Key(string controller, string action, string http) => $"{controller}.{action} [{http}]";

    [Fact]
    public void AnonymousEndpoints_MatchApprovedList_NoneAddedNoneStale()
    {
        var actual = DiscoverAnonymousActions();
        var approved = Approved.ToDictionary(a => Key(a.Controller, a.Action, a.Http), a => a);

        Assert.Equal(Approved.Length, approved.Count); // dubbletter på listan

        var unapproved = actual.Keys.Except(approved.Keys).OrderBy(k => k).ToList();
        var stale = approved.Keys.Except(actual.Keys).OrderBy(k => k).ToList();

        var problems = new List<string>();
        if (unapproved.Count > 0)
            problems.Add("Anonyma endpoints som INTE står på den godkända listan (lägg [Authorize] på dem, eller lägg till en rad med motivering i Approved):\n"
                + string.Join("\n", unapproved.Select(k => $"  {k}  ->  {actual[k]}")));
        if (stale.Count > 0)
            problems.Add("Rader på den godkända listan som inte längre är anonyma endpoints (ta bort raden):\n"
                + string.Join("\n", stale.Select(k => $"  {k}")));

        Assert.True(problems.Count == 0, string.Join("\n\n", problems));
    }

    [Fact]
    public void ApprovedList_EveryRowHasMotivation()
    {
        Assert.All(Approved, a => Assert.False(string.IsNullOrWhiteSpace(a.Why), $"{a.Controller}.{a.Action} saknar motivering"));
    }

    // Nyckel -> "VERB route" för felmeddelandet.
    private static Dictionary<string, string> DiscoverAnonymousActions()
    {
        var result = new Dictionary<string, string>();

        var controllers = typeof(EventsController).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t));

        foreach (var controller in controllers)
        {
            var classAttrs = controller.GetCustomAttributes(inherit: true);
            var classHasAuthorize = classAttrs.OfType<IAuthorizeData>().Any();
            var classAllowsAnon = classAttrs.OfType<IAllowAnonymous>().Any();
            var classRoute = classAttrs.OfType<RouteAttribute>().FirstOrDefault()?.Template;

            var actions = controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName && !m.GetCustomAttributes<NonActionAttribute>().Any());

            foreach (var method in actions)
            {
                var verbs = method.GetCustomAttributes<HttpMethodAttribute>(inherit: true).ToList();
                if (verbs.Count == 0)
                    continue; // inte routbar utan HTTP-attribut (ApiController kräver attributrouting)

                var methodAttrs = method.GetCustomAttributes(inherit: true);
                var methodHasAuthorize = methodAttrs.OfType<IAuthorizeData>().Any();
                var methodAllowsAnon = methodAttrs.OfType<IAllowAnonymous>().Any();

                var anonymous = classAllowsAnon || methodAllowsAnon || !(classHasAuthorize || methodHasAuthorize);
                if (!anonymous)
                    continue;

                foreach (var verb in verbs)
                {
                    var http = string.Join("/", verb.HttpMethods);
                    var route = FullRoute(controller, classRoute, verb.Template);
                    result[Key(ControllerName(controller), method.Name, http)] = $"{http} {route}";
                }
            }
        }

        return result;
    }

    private static string ControllerName(Type t) => t.Name;

    private static string FullRoute(Type controller, string? classRoute, string? methodTemplate)
    {
        var prefix = (classRoute ?? "").Replace("[controller]", controller.Name.Replace("Controller", ""), StringComparison.OrdinalIgnoreCase);
        if (methodTemplate is not null && (methodTemplate.StartsWith('/') || methodTemplate.StartsWith("~/")))
            return "/" + methodTemplate.TrimStart('~', '/');
        return "/" + string.Join("/", new[] { prefix, methodTemplate }.Where(s => !string.IsNullOrEmpty(s)).Select(s => s!.Trim('/')));
    }
}
