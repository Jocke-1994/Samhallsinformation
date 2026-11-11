namespace Samhallsinformation.Application.Auth;

using System.Linq.Expressions;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Enda platsen som utför GDPR-anonymiseringen av ett konto (V2-14). Anropas av
/// <c>UserDeletionBackgroundService</c> när 24 h-ångerfönstret gått ut — både självbetjäningens
/// och adminens raderingsväg schemalägger bara (<c>DeletionScheduledAt</c>) och delar därmed
/// den här metoden.
///
/// Tre åtgärder (hela inventeringen finns i PR-texten):
///  - RADERA rader som bara är användarens egna val/sessioner (enheter, tokens, sparade händelser, bevakningar ...).
///  - ANONYMISERA rader som måste finnas kvar (supportärenden, loggar): identifierare ersätts, raden och
///    <c>UserId</c> (pseudonym) behålls för spårbarhet.
///  - BEHÅLL övrigt.
///
/// Allt sker i EN transaktion per användare, och <c>DeletedAt</c> (markeringen "klar") sätts sist i samma
/// transaktion. Kastar något rullas allt tillbaka och kontot försöks igen nästa cykel.
/// </summary>
public static class UserAnonymizer
{
    public const string Redacted = "[borttagen]";
    public const string AnonymizedName = "Raderad användare";

    // Generiska namn som aldrig ska användas som sökterm vid textrensning (skulle rensa orelaterad text).
    private static readonly HashSet<string> NameStopList = new(StringComparer.OrdinalIgnoreCase)
    {
        AnonymizedName, "Användare", "Admin", "Support", "System", "Okänd", "user",
    };

    private const int MinIdentifierLength = 2;
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);

    /// <summary>
    /// Anonymiserar <paramref name="userId"/>. Idempotent: ett redan anonymiserat konto (DeletedAt satt) lämnas orört.
    /// Vid fel rullas hela användarens anonymisering tillbaka, change trackern tömmas och undantaget kastas vidare.
    /// </summary>
    public static async Task AnonymizeAsync(AppDbContext db, Guid userId, DateTime now, CancellationToken ct = default)
    {
        db.ChangeTracker.Clear();
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user == null || user.DeletedAt != null) return;

            var ids = await CollectIdentifiersAsync(db, user, ct);

            await DeleteOwnedRowsAsync(db, userId, ct);
            await ScrubSupportAsync(db, user, ids, ct);
            await ScrubLogsAsync(db, user, ids, ct);
            await ScrubFeatureIdeasAsync(db, ids, ct);
            await db.EventShareLogs.Where(x => x.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, (Guid?)null), ct);

            user.Name = AnonymizedName;
            user.DisplayName = null;
            user.Email = $"deleted-{Guid.NewGuid():N}@anonymized.local";
            user.PasswordHash = "";
            user.Role = "Användare";
            user.IsActive = false;
            user.SuspendedReason = "Konto raderat (GDPR)";
            user.SuspensionReminderAt = null;
            user.SuspensionReminderNote = null;
            user.DeletionScheduledAt = null;
            user.DeletionCancelToken = null;
            user.DeletedAt = now; // "klar"-markeringen — sist, i samma transaktion som allt ovan

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            db.ChangeTracker.Clear();
            throw;
        }
    }

    // ------------------------------------------------------------------ identifierare

    private sealed record Identifiers(
        List<string> Emails,          // kontots adresser (nuvarande + historiska) — unika, rensas globalt
        List<string> Names,           // kontots namn (nuvarande + historiska) — rensas i loggar och i användarens ärenden
        List<string> TicketExtras,    // kontaktnamn/-adresser användaren angav i sina ärenden — bara inom dessa ärenden
        HashSet<Guid> PartyTicketIds);

    private static async Task<Identifiers> CollectIdentifiersAsync(AppDbContext db, User user, CancellationToken ct)
    {
        var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddEmail(string? e)
        {
            var n = EmailNormalizer.Normalize(e);
            if (n.Length >= 3 && n.Contains('@')) emails.Add(n);
        }
        var tokenSources = new HashSet<string>(StringComparer.OrdinalIgnoreCase); // namn som får delas upp i förnamn/efternamn
        void AddName(string? n, bool tokenise = true)
        {
            var t = n?.Trim();
            if (t == null || t.Length < MinIdentifierLength || NameStopList.Contains(t) || t.Contains('@')) return;
            names.Add(t);
            if (tokenise) tokenSources.Add(t);
        }

        AddEmail(user.Email);
        AddName(user.Name);
        AddName(user.DisplayName, tokenise: false); // visningsnamn är ofta ett vanligt ord — bara som helhet

        var settingRows = await db.UserSettingAuditLogs
            .Where(x => x.UserId == user.Id && (x.Setting == "email" || x.Setting == "name" || x.Setting == "displayName"))
            .Select(x => new { x.Setting, x.OldValue, x.NewValue })
            .ToListAsync(ct);
        foreach (var r in settingRows)
        {
            if (r.Setting == "email") { AddEmail(r.OldValue); AddEmail(r.NewValue); }
            else
            {
                var tok = r.Setting == "name";
                AddName(r.OldValue, tok); AddName(r.NewValue, tok);
            }
        }
        foreach (var e in await db.EmailChangeTokens.Where(x => x.UserId == user.Id).Select(x => x.NewEmail).ToListAsync(ct))
            AddEmail(e);

        // Ärenden där användaren är part: skapade av kontot, eller inkomna via mejl från en av kontots adresser.
        var emailList = emails.ToList();
        var party = await db.SupportTickets
            .Where(x => x.CreatedByUserId == user.Id
                        || (x.ContactEmail != null && emailList.Contains(x.ContactEmail.ToLower())))
            .Select(x => new { x.Id, x.ContactName, x.ContactEmail })
            .ToListAsync(ct);

        var extras = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in party)
        {
            var cn = p.ContactName?.Trim();
            if (cn is { Length: >= MinIdentifierLength } && !NameStopList.Contains(cn)) extras.Add(cn);
            var ce = EmailNormalizer.Normalize(p.ContactEmail);
            if (ce.Length >= 3 && ce.Contains('@')) extras.Add(ce);
        }

        // Inom användarens egna ärenden räcker det inte med hela namnet: personal skriver ofta "Hej Ada," och
        // avsändare signerar med förnamn. Därför rensas även enskilda namndelar (>= 3 tecken) — men bara där
        // (ärenden, deras meddelanden/åtgärder/idéer), inte i loggar som delas med andra.
        foreach (var full in tokenSources.Concat(extras.Where(x => !x.Contains('@'))).ToList())
            foreach (var token in full.Split([' ', '-', '.', ','], StringSplitOptions.RemoveEmptyEntries))
                if (token.Length >= 3 && !NameStopList.Contains(token)) extras.Add(token);

        return new Identifiers(emails.ToList(), names.ToList(), extras.ToList(), party.Select(p => p.Id).ToHashSet());
    }

    // ------------------------------------------------------------------ RADERA

    private static async Task DeleteOwnedRowsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        await db.UserDevices.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.RefreshTokens.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.PasswordResetTokens.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.EmailVerificationTokens.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.EmailChangeTokens.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.UserSavedEvents.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.UserSourcePreferences.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.UserNotificationSettings.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.UserDoNotDisturbSchedules.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.PolisenBevakningar.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.PushDispatchClaims.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.FeatureIdeaTesters.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);

        // UserPreference.UserId är en sträng (Guid som text), inte en FK.
        var idText = userId.ToString().ToLowerInvariant();
        await db.UserPreferences.Where(x => x.UserId.ToLower() == idText).ExecuteDeleteAsync(ct);
    }

    // ------------------------------------------------------------------ ANONYMISERA: support

    private static async Task ScrubSupportAsync(AppDbContext db, User user, Identifiers ids, CancellationToken ct)
    {
        var partyIds = ids.PartyTicketIds.ToList();
        var partyText = new TextScrubber(ids.Emails.Concat(ids.Names).Concat(ids.TicketExtras));
        var emailText = new TextScrubber(ids.Emails);

        // Ärendena där användaren är part: kontaktuppgifterna ersätts, texten rensas på användarens uppgifter.
        var tickets = await db.SupportTickets.Where(x => partyIds.Contains(x.Id)).ToListAsync(ct);
        foreach (var tk in tickets)
        {
            if (tk.ContactName != null) tk.ContactName = AnonymizedName;
            if (tk.ContactEmail != null) tk.ContactEmail = $"deleted-{tk.Id:N}@anonymized.local";
            tk.Subject = partyText.Scrub(tk.Subject)!;
            tk.ReminderNote = partyText.Scrub(tk.ReminderNote);
        }

        // Övriga ärenden: bara den unika e-postadressen rensas (aldrig namn — kan vara någon annan).
        var otherTickets = await FindContainingAsync(
            db.SupportTickets.Where(x => !partyIds.Contains(x.Id)), ids.Emails,
            term => x => x.Subject.ToLower().Contains(term) || x.Subject.Contains(term)
                         || (x.ReminderNote != null && (x.ReminderNote.ToLower().Contains(term) || x.ReminderNote.Contains(term))),
            ct);
        foreach (var tk in otherTickets)
        {
            tk.Subject = emailText.Scrub(tk.Subject)!;
            tk.ReminderNote = emailText.Scrub(tk.ReminderNote);
        }

        // Meddelanden: i användarens ärenden + användarens egna (personalens) meddelanden → e-post och namn.
        // Övriga meddelanden → bara e-postadress.
        var msgs = await db.SupportTicketMessages
            .Where(x => partyIds.Contains(x.TicketId) || x.AuthorUserId == user.Id).ToListAsync(ct);
        foreach (var m in msgs) m.Text = partyText.Scrub(m.Text)!;

        var seenMsgs = msgs.Select(m => m.Id).ToHashSet();
        var otherMsgs = await FindContainingAsync(db.SupportTicketMessages, ids.Emails,
            term => x => x.Text.ToLower().Contains(term) || x.Text.Contains(term), ct);
        foreach (var m in otherMsgs.Where(m => !seenMsgs.Contains(m.Id)))
            m.Text = emailText.Scrub(m.Text)!;

        // Schemalagda åtgärder. Ej utförda åtgärder i användarens ärenden kan aldrig levereras (adressen är borta) → raderas.
        await db.SupportTicketScheduledActions
            .Where(x => partyIds.Contains(x.TicketId) && !x.Executed).ExecuteDeleteAsync(ct);
        var actions = await db.SupportTicketScheduledActions
            .Where(x => partyIds.Contains(x.TicketId) || x.CreatedByUserId == user.Id).ToListAsync(ct);
        foreach (var a in actions)
        {
            a.Text = partyText.Scrub(a.Text);
            a.Instruction = partyText.Scrub(a.Instruction);
        }
        var seenActions = actions.Select(a => a.Id).ToHashSet();
        var otherActions = await FindContainingAsync(db.SupportTicketScheduledActions, ids.Emails,
            term => x => (x.Text != null && (x.Text.ToLower().Contains(term) || x.Text.Contains(term)))
                         || (x.Instruction != null && (x.Instruction.ToLower().Contains(term) || x.Instruction.Contains(term))),
            ct);
        foreach (var a in otherActions.Where(a => !seenActions.Contains(a.Id)))
        {
            a.Text = emailText.Scrub(a.Text);
            a.Instruction = emailText.Scrub(a.Instruction);
        }
    }

    // ------------------------------------------------------------------ ANONYMISERA: loggar

    private static async Task ScrubLogsAsync(AppDbContext db, User user, Identifiers ids, CancellationToken ct)
    {
        var all = ids.Emails.Concat(ids.Names).ToList();
        var allText = new TextScrubber(all);
        var emailText = new TextScrubber(ids.Emails);

        // --- AdminActivityLogs: behålls (ansvarsskyldighet); namn/e-post i text → [borttagen].
        var activity = await FindContainingAsync(db.AdminActivityLogs, all,
            term => x => x.Vem.ToLower().Contains(term) || x.Rubrik.ToLower().Contains(term) || x.Detalj.ToLower().Contains(term)
                         || (x.GammaltVärde != null && x.GammaltVärde.ToLower().Contains(term))
                         || (x.NyttVärde != null && x.NyttVärde.ToLower().Contains(term))
                         || x.Vem.Contains(term) || x.Rubrik.Contains(term) || x.Detalj.Contains(term)
                         || (x.GammaltVärde != null && x.GammaltVärde.Contains(term))
                         || (x.NyttVärde != null && x.NyttVärde.Contains(term)),
            ct);
        foreach (var l in activity)
        {
            var actorIsUser = allText.Scrub(l.Vem) != l.Vem;
            var mentioned = allText.Scrub(l.Rubrik) != l.Rubrik || allText.Scrub(l.Detalj) != l.Detalj
                              || allText.Scrub(l.GammaltVärde) != l.GammaltVärde || allText.Scrub(l.NyttVärde) != l.NyttVärde;

            l.Vem = allText.Scrub(l.Vem)!;
            l.Rubrik = allText.Scrub(l.Rubrik)!;
            l.Detalj = allText.Scrub(l.Detalj)!;
            l.GammaltVärde = allText.Scrub(l.GammaltVärde);
            l.NyttVärde = allText.Scrub(l.NyttVärde);

            // En System-händelse om användaren (registrering, ärende, ångra-länk ...) loggar användarens egen IP/enhet.
            // Adminhändelser om användaren loggar ADMINENS IP — den rörs inte. Användaren som aktör (personal) → egen IP.
            if (actorIsUser || (mentioned && l.AktörTyp == "System"))
            {
                l.Ip = null;
                l.Enhet = null;
            }
        }

        // --- UserSettingAuditLogs: användarens egna rader behålls (UserId = pseudonym). Värden som ÄR persondata
        // (namn, visningsnamn, e-post, geografiska bevakningar) ersätts helt; övriga rensas på namn/e-post.
        var ownSettings = await db.UserSettingAuditLogs.Where(x => x.UserId == user.Id).ToListAsync(ct);
        foreach (var l in ownSettings)
        {
            if (l.Setting is "name" or "displayName" or "email" || l.Setting.StartsWith("polisen_bevakning", StringComparison.Ordinal))
            {
                if (l.OldValue != null) l.OldValue = Redacted;
                if (l.NewValue != null) l.NewValue = Redacted;
            }
            else
            {
                l.OldValue = allText.Scrub(l.OldValue);
                l.NewValue = allText.Scrub(l.NewValue);
            }
        }
        var seenSettings = ownSettings.Select(l => l.Id).ToHashSet();
        var otherSettings = await FindContainingAsync(db.UserSettingAuditLogs, ids.Emails,
            term => x => (x.OldValue != null && (x.OldValue.ToLower().Contains(term) || x.OldValue.Contains(term)))
                         || (x.NewValue != null && (x.NewValue.ToLower().Contains(term) || x.NewValue.Contains(term))),
            ct);
        foreach (var l in otherSettings.Where(l => !seenSettings.Contains(l.Id)))
        {
            l.OldValue = emailText.Scrub(l.OldValue);
            l.NewValue = emailText.Scrub(l.NewValue);
        }

        // --- NotificationDeliveryLogs: användarens egna rader → mottagaren (push-endpoint = bestående identifierare)
        // ersätts; alla loggrader (även andra användares, t.ex. adminens ny-användare-notis) rensas på namn/e-post.
        var ownDeliveries = await db.NotificationDeliveryLogs.Where(x => x.UserId == user.Id).ToListAsync(ct);
        foreach (var l in ownDeliveries)
        {
            l.Recipient = Redacted;
            l.Subject = allText.Scrub(l.Subject)!;
            l.Body = allText.Scrub(l.Body)!;
            l.ErrorMessage = allText.Scrub(l.ErrorMessage);
        }
        var seenDeliveries = ownDeliveries.Select(l => l.Id).ToHashSet();
        var otherDeliveries = await FindContainingAsync(db.NotificationDeliveryLogs, all,
            term => x => x.Recipient.ToLower().Contains(term) || x.Subject.ToLower().Contains(term) || x.Body.ToLower().Contains(term)
                         || (x.ErrorMessage != null && x.ErrorMessage.ToLower().Contains(term))
                         || x.Recipient.Contains(term) || x.Subject.Contains(term) || x.Body.Contains(term)
                         || (x.ErrorMessage != null && x.ErrorMessage.Contains(term)),
            ct);
        foreach (var l in otherDeliveries.Where(l => !seenDeliveries.Contains(l.Id)))
        {
            l.Recipient = allText.Scrub(l.Recipient)!;
            l.Subject = allText.Scrub(l.Subject)!;
            l.Body = allText.Scrub(l.Body)!;
            l.ErrorMessage = allText.Scrub(l.ErrorMessage);
        }
    }

    // ------------------------------------------------------------------ ANONYMISERA: idéer (fritext som kan ha kopierats från ärenden)

    private static async Task ScrubFeatureIdeasAsync(AppDbContext db, Identifiers ids, CancellationToken ct)
    {
        var emailText = new TextScrubber(ids.Emails);
        var partyText = new TextScrubber(ids.Emails.Concat(ids.Names).Concat(ids.TicketExtras));
        var partyIds = ids.PartyTicketIds.ToList();

        var ideas = await FindContainingAsync(db.FeatureIdeas, ids.Emails,
            term => x => x.Title.ToLower().Contains(term) || x.Description.ToLower().Contains(term)
                         || (x.TriageMotivering != null && x.TriageMotivering.ToLower().Contains(term))
                         || x.Title.Contains(term) || x.Description.Contains(term)
                         || (x.TriageMotivering != null && x.TriageMotivering.Contains(term)),
            ct);
        foreach (var i in ideas)
        {
            i.Title = emailText.Scrub(i.Title)!;
            i.Description = emailText.Scrub(i.Description)!;
            i.TriageMotivering = emailText.Scrub(i.TriageMotivering);
        }

        // Idéer som kommer från användarens ärenden: rensa även namn.
        var fromTickets = await db.FeatureIdeas
            .Where(x => x.SourceTicketId != null && partyIds.Contains(x.SourceTicketId.Value)).ToListAsync(ct);
        foreach (var i in fromTickets)
        {
            i.Title = partyText.Scrub(i.Title)!;
            i.Description = partyText.Scrub(i.Description)!;
            i.TriageMotivering = partyText.Scrub(i.TriageMotivering);
        }

        var items = await FindContainingAsync(db.FeatureIdeaChecklistItems, ids.Emails,
            term => x => x.Label.ToLower().Contains(term) || x.Label.Contains(term), ct);
        foreach (var c in items)
            c.Label = emailText.Scrub(c.Label)!;
    }

    // ------------------------------------------------------------------ hjälpare

    /// <summary>
    /// Hämtar (spårade) rader vars text innehåller minst en av <paramref name="terms"/>. Förfiltret körs i databasen
    /// (både gemener och originalstavning, eftersom SQLites lower() bara klarar ASCII); exakt ordgränskontroll görs sedan av
    /// <see cref="TextScrubber"/> — en rad som visar sig vara en falsk träff ändras inte.
    /// </summary>
    private static async Task<List<T>> FindContainingAsync<T>(
        IQueryable<T> source, IEnumerable<string> terms,
        Func<string, Expression<Func<T, bool>>> predicate, CancellationToken ct) where T : class
    {
        var found = new List<T>();
        var seen = new HashSet<T>(ReferenceEqualityComparer.Instance);
        foreach (var term in terms.Select(t => t.ToLowerInvariant()).Distinct())
        {
            foreach (var row in await source.Where(predicate(term)).ToListAsync(ct))
                if (seen.Add(row)) found.Add(row);
        }
        return found;
    }

    /// <summary>Ersätter förekomster av givna namn/adresser med <see cref="Redacted"/> (hela ord, skiftlägesokänsligt).</summary>
    private sealed class TextScrubber
    {
        private readonly List<Regex> _patterns;

        public TextScrubber(IEnumerable<string> terms)
        {
            _patterns = terms
                .Select(t => t.Trim())
                .Where(t => t.Length >= MinIdentifierLength)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(t => t.Length) // längst först: "Ada Lovelace" före "Ada"
                .Select(t => new Regex(
                    $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(t)}(?![\p{{L}}\p{{N}}])",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, RegexTimeout))
                .ToList();
        }

        public string? Scrub(string? text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            foreach (var p in _patterns) text = p.Replace(text, Redacted);
            return text;
        }
    }
}
