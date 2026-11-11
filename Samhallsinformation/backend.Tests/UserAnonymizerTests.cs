namespace Samhallsinformation.Tests;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V2-14: GDPR-anonymiseringen ska täcka ALLA tabeller med persondata, inte bara User-raden.
/// Körs mot SQLite (TestDb) eftersom transaktioner, ExecuteDelete och rollback måste vara på riktigt.
/// </summary>
public class UserAnonymizerTests
{
    private const string AdaName = "Ada Lovelace";
    private const string AdaEmail = "ada.lovelace@example.com";
    private const string AdaOldEmail = "ada.gammal@example.com";
    private const string AdaNewEmail = "ada.ny@example.com";
    private const string AdaOldName = "Ada L";

    // ------------------------------------------------------------------ seed

    private static int _no;
    private sealed record Base(User Admin, Source Source, CanonicalEvent Event);
    private sealed record Person(string Name, string Email, string OldEmail, string OldName, string Tag, string Ip);

    private static readonly Person Ada = new(AdaName, AdaEmail, AdaOldEmail, AdaOldName, "ada", "203.0.113.5");
    private static readonly Person Bertil = new("Bertil Bergman", "bertil@example.org", "bertil.gammal@example.org", "Bert B", "bertil", "203.0.113.9");

    private static async Task<Base> SeedBaseAsync(AppDbContext db)
    {
        var admin = new User { Name = "Sture Admin", Email = "sture@samhallsinformation.se", PasswordHash = "x", Role = "Admin" };
        var source = new Source { Name = "Testkälla", ShortName = "Test" };
        db.Users.Add(admin);
        db.Sources.Add(source);
        await db.SaveChangesAsync();
        var ev = new CanonicalEvent { SourceId = source.Id, ExternalId = "e1", Title = "Händelse", PublishedAt = DateTime.UtcNow };
        db.Events.Add(ev);
        await db.SaveChangesAsync();
        return new Base(admin, source, ev);
    }

    /// <summary>Data i VARJE tabell som kan knytas till en person. Samma form för alla personer så att en "andra användare" kan jämföras.</summary>
    private static async Task<User> SeedPersonAsync(AppDbContext db, Base b, Person p, bool dueForDeletion = true)
    {
        var user = new User
        {
            Name = p.Name,
            DisplayName = p.Name.Split(' ')[0] + "-visning",
            Email = p.Email,
            PasswordHash = "hash",
            IsActive = !dueForDeletion,
            SuspendedReason = dueForDeletion ? "Radering begärd" : null,
            DeletionScheduledAt = dueForDeletion ? DateTime.UtcNow.AddMinutes(-1) : null,
            DeletionCancelToken = dueForDeletion ? "canceltoken-" + p.Tag : null,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var id = user.Id;

        // --- RADERAS
        db.UserDevices.Add(new UserDevice { UserId = id, Endpoint = $"https://push.example/{p.Tag}", P256dh = "k", Auth = "a", DeviceName = "Telefon", Platform = "android" });
        db.RefreshTokens.Add(new RefreshToken { UserId = id, TokenHash = "rt-" + p.Tag, ExpiresAt = DateTime.UtcNow.AddDays(30) });
        db.PasswordResetTokens.Add(new PasswordResetToken { UserId = id, Token = "pr-" + p.Tag });
        db.EmailVerificationTokens.Add(new EmailVerificationToken { UserId = id, Token = "ev-" + p.Tag });
        db.EmailChangeTokens.Add(new EmailChangeToken { UserId = id, NewEmail = p.Tag + ".ny@example.com", Token = "ec-" + p.Tag });
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = id, EventId = b.Event.Id });
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = id, SourceId = b.Source.Id });
        db.UserNotificationSettings.Add(new UserNotificationSetting { UserId = id, SourceId = b.Source.Id, PushEnabled = true });
        db.UserDoNotDisturbSchedules.Add(new UserDoNotDisturbSchedule { UserId = id, IsEnabled = true, StartTime = new TimeOnly(22, 0), EndTime = new TimeOnly(7, 0) });
        db.PolisenBevakningar.Add(new PolisenBevakning { UserId = id, KategorierJson = "[\"Brand\"]", OmradenJson = "[\"Uppsala\"]" });
        db.PushDispatchClaims.Add(new PushDispatchClaim { UserId = id, ClaimedAt = DateTime.UtcNow });
        db.UserPreferences.Add(new UserPreference { UserId = id.ToString(), GeographyFilter = "Uppsala" });
        var idea = new FeatureIdea
        {
            IdeaNumber = ++_no,
            Title = "Idé från " + p.Name,
            Description = "Kontakt " + p.Email,
            CreatedByUserId = b.Admin.Id,
        };
        db.FeatureIdeas.Add(idea);
        await db.SaveChangesAsync();
        db.FeatureIdeaTesters.Add(new FeatureIdeaTester { FeatureIdeaId = idea.Id, UserId = id });
        db.FeatureIdeaChecklistItems.Add(new FeatureIdeaChecklistItem { FeatureIdeaId = idea.Id, Label = "Testa med " + p.Email });

        // --- ANONYMISERAS: användarens egna loggar
        db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = id, Setting = "name", OldValue = p.OldName, NewValue = p.Name });
        db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = id, Setting = "email", OldValue = p.OldEmail, NewValue = p.Email });
        db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = id, Setting = "polisen_bevakning_skapad", NewValue = "1 kategorier, 1 områden", ChangedBy = "admin" });
        db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = id, Setting = "password", ChangedBy = "reset" });
        db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = id, Setting = "notiser", OldValue = "false", NewValue = "true", ChangedBy = "admin" });
        db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog { UserId = id, Channel = "push", Recipient = $"https://push.example/{p.Tag}", Subject = "Samhällsinformation", Body = "2 nya händelser" });
        // Adminens ny-användare-notis — lagras under ADMINENS UserId men innehåller den nya användarens namn + e-post.
        db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog { UserId = b.Admin.Id, Channel = "push", Recipient = "https://push.example/admin", Subject = "Ny användare", Body = $"{p.Name} ({p.Email}) skapade ett konto" });
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "System", Vem = "System", Typ = "Registrering", Rubrik = "Ny registrering", Detalj = $"{p.Name} — via Lösenord", Ip = p.Ip, Enhet = "Mozilla " + p.Tag });
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Sture Admin", Typ = "Konto", Rubrik = $"Konto spärrat — {p.Name}", Detalj = "Missbruk", Ip = "198.51.100.1", Enhet = "AdminBrowser", AngraAnvandareId = id.ToString() });
        db.EventShareLogs.Add(new EventShareLog { EventId = b.Event.Id, UserId = id });

        // --- ANONYMISERAS: supportärende skapat av kontot
        var ticket = new SupportTicket
        {
            TicketNumber = ++_no,
            Subject = $"Fråga från {p.Name.Split(' ')[0]}",
            Category = "Övrigt",
            CreatedByUserId = id,
            ContactName = p.Name,
            ContactEmail = p.Email,
            AssignedToUserId = b.Admin.Id,
            ReminderNote = "Ring " + p.Name,
        };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync();
        db.SupportTicketMessages.Add(new SupportTicketMessage { TicketId = ticket.Id, SenderType = "user", AuthorUserId = id, Text = $"Hej, jag heter {p.Name} och min mejl är {p.Email}. Tack för hjälpen" });
        db.SupportTicketMessages.Add(new SupportTicketMessage { TicketId = ticket.Id, SenderType = "support", AuthorUserId = b.Admin.Id, Text = $"Hej {p.Name.Split(' ')[0]}, vi svarar till {p.Email}" });
        db.SupportTicketMessages.Add(new SupportTicketMessage { TicketId = ticket.Id, SenderType = "support", AuthorUserId = b.Admin.Id, IsInternal = true, Text = $"{p.Name} verkar irriterad" });
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction { TicketId = ticket.Id, CreatedByUserId = b.Admin.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddDays(1), Text = "Hej " + p.Name.Split(' ')[0] });
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction { TicketId = ticket.Id, CreatedByUserId = b.Admin.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddDays(-1), Executed = true, ExecutedAt = DateTime.UtcNow, Text = "Skickat till " + p.Email });
        db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog { UserId = b.Admin.Id, Channel = "push", Recipient = "https://push.example/admin", Subject = "Nytt ärende", Body = ticket.Subject });
        idea.SourceTicketId = ticket.Id;

        // --- ANONYMISERAS: ärende som kom in via mejl (ingen kontokoppling, bara avsändaradressen — med annan skiftläge)
        var mailTicket = new SupportTicket
        {
            TicketNumber = ++_no,
            Subject = "Mejl utan konto",
            Category = "Övrigt",
            Channel = "info-mejl",
            ContactName = "A. " + p.Name.Split(' ')[1],
            ContactEmail = p.Email.ToUpperInvariant(),
        };
        db.SupportTickets.Add(mailTicket);
        await db.SaveChangesAsync();
        db.SupportTicketMessages.Add(new SupportTicketMessage { TicketId = mailTicket.Id, SenderType = "user", Text = $"Mvh A. {p.Name.Split(' ')[1]}" });

        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<Guid> AddDueUserAsync(AppDbContext db, string name, string email)
    {
        var u = new User { Name = name, Email = email, PasswordHash = "x", IsActive = false, DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-1) };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u.Id;
    }

    // ------------------------------------------------------------------ dump-hjälpare

    private static IEnumerable<(Type Type, object Row, AppDbContext Ctx)> AllRows(AppDbContext ctx)
    {
        var set = typeof(DbContext).GetMethods().First(m => m.Name == "Set" && m.IsGenericMethodDefinition && m.GetParameters().Length == 0);
        foreach (var et in ctx.Model.GetEntityTypes().Where(e => !e.IsOwned()))
        {
            var q = (System.Collections.IEnumerable)set.MakeGenericMethod(et.ClrType).Invoke(ctx, null)!;
            foreach (var row in q) yield return (et.ClrType, row, ctx);
        }
    }

    /// <summary>"Tabell:nyckel" → alla kolumnvärden. Läser via en färsk kontext så att change trackern inte ljuger.</summary>
    private static Dictionary<string, string> Snapshot(AppDbContext db)
    {
        using var fresh = TestDb.CreateSecondContext(db);
        var dict = new Dictionary<string, string>();
        foreach (var (type, row, ctx) in AllRows(fresh))
        {
            var entry = ctx.Entry(row);
            var key = string.Join("/", entry.Metadata.FindPrimaryKey()!.Properties.Select(p => Convert.ToString(entry.Property(p.Name).CurrentValue, CultureInfo.InvariantCulture)));
            dict[$"{type.Name}:{key}"] = string.Join("|", entry.Properties.Select(p => $"{p.Metadata.Name}={Convert.ToString(p.CurrentValue, CultureInfo.InvariantCulture)}"));
        }
        return dict;
    }

    /// <summary>Alla strängvärden i alla tabeller: (tabell.kolumn, värde).</summary>
    private static List<(string Column, string Value)> AllTextValues(AppDbContext db)
    {
        using var fresh = TestDb.CreateSecondContext(db);
        var list = new List<(string, string)>();
        foreach (var (type, row, ctx) in AllRows(fresh))
            foreach (var p in ctx.Entry(row).Properties.Where(p => p.Metadata.ClrType == typeof(string) && p.CurrentValue is string))
                list.Add(($"{type.Name}.{p.Metadata.Name}", (string)p.CurrentValue!));
        return list;
    }

    private static async Task RunAsync(AppDbContext db, int expected = 1)
    {
        var done = await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);
        Assert.Equal(expected, done);
    }

    // ------------------------------------------------------------------ tester

    [Fact]
    public async Task Anonymisering_RaderarAllaAnvandarensEgnaRader_iVarjeRaderbarTabell()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);
        var id = ada.Id;

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        Assert.Empty(check.UserDevices.Where(x => x.UserId == id));
        Assert.Empty(check.RefreshTokens.Where(x => x.UserId == id));
        Assert.Empty(check.PasswordResetTokens.Where(x => x.UserId == id));
        Assert.Empty(check.EmailVerificationTokens.Where(x => x.UserId == id));
        Assert.Empty(check.EmailChangeTokens.Where(x => x.UserId == id));
        Assert.Empty(check.UserSavedEvents.Where(x => x.UserId == id));
        Assert.Empty(check.UserSourcePreferences.Where(x => x.UserId == id));
        Assert.Empty(check.UserNotificationSettings.Where(x => x.UserId == id));
        Assert.Empty(check.UserDoNotDisturbSchedules.Where(x => x.UserId == id));
        Assert.Empty(check.PolisenBevakningar.Where(x => x.UserId == id));
        Assert.Empty(check.PushDispatchClaims.Where(x => x.UserId == id));
        Assert.Empty(check.FeatureIdeaTesters.Where(x => x.UserId == id));
        Assert.Empty(check.UserPreferences.Where(x => x.UserId == id.ToString()));
    }

    [Fact]
    public async Task Anonymisering_UserRaden_TommasPaAllaIdentifierare()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var u = await check.Users.SingleAsync(x => x.Id == ada.Id);
        Assert.Equal("Raderad användare", u.Name);
        Assert.Null(u.DisplayName);
        Assert.Null(u.DeletionCancelToken);
        Assert.Equal("", u.PasswordHash);
        Assert.EndsWith("@anonymized.local", u.Email);
        Assert.NotNull(u.DeletedAt);
        Assert.False(u.IsActive);
    }

    [Fact]
    public async Task Anonymisering_IngenTextkolumnIDatabasenInnehallerNamnEllerEpost()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        // Före: persondatan finns (annars bevisar testet ingenting).
        var before = AllTextValues(db);
        Assert.Contains(before, v => v.Value.Contains(AdaEmail, StringComparison.OrdinalIgnoreCase));
        Assert.Contains(before, v => v.Column == "NotificationDeliveryLog.Body" && v.Value.Contains(AdaName));

        await RunAsync(db);

        var forbidden = new[] { AdaName, AdaEmail, AdaOldEmail, AdaNewEmail, AdaOldName, "A. Lovelace", "Ada-visning", "canceltoken-ada", "push.example/ada" };
        foreach (var (column, value) in AllTextValues(db))
            foreach (var f in forbidden)
                Assert.False(value.Contains(f, StringComparison.OrdinalIgnoreCase), $"{column} innehåller fortfarande '{f}': {value}");
    }

    [Fact]
    public async Task Anonymisering_FornamnRensasIAnvandarensArenden_menInteIAndraTabeller()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        var ticketText = AllTextValues(db).Where(v =>
            v.Column.StartsWith("SupportTicket.") || v.Column.StartsWith("SupportTicketMessage.")
            || v.Column.StartsWith("SupportTicketScheduledAction.") || v.Column.StartsWith("FeatureIdea."));
        // Hela ordet "Ada", inte delsträngen: de anonymiserade adresserna (deleted-{guid}@anonymized.local)
        // innehåller slumpmässiga hex-GUID:er som av en ren tillfällighet kan innehålla "ada" (~1–2 % av körningarna).
        foreach (var (column, value) in ticketText)
            Assert.False(System.Text.RegularExpressions.Regex.IsMatch(value, @"\bAda\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase),
                $"{column} innehåller fortfarande förnamnet 'Ada': {value}");
    }

    [Fact]
    public async Task Anonymisering_Supportarenden_BehallsMenKontaktuppgifterOchNamnBorta()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var tickets = await check.SupportTickets.OrderBy(t => t.TicketNumber).ToListAsync();
        Assert.Equal(2, tickets.Count); // båda ärendena finns kvar (supporthistorik)
        Assert.All(tickets, t =>
        {
            Assert.Equal("Raderad användare", t.ContactName);
            Assert.EndsWith("@anonymized.local", t.ContactEmail);
        });
        Assert.Equal(ada.Id, tickets[0].CreatedByUserId); // pseudonym behålls

        // Meddelandena finns kvar, men texten är rensad — den övriga texten bevarad.
        var msgs = await check.SupportTicketMessages.ToListAsync();
        Assert.Equal(4, msgs.Count);
        var userMsg = msgs.Single(m => m.Text.StartsWith("Hej, jag heter"));
        Assert.Equal("Hej, jag heter [borttagen] och min mejl är [borttagen]. Tack för hjälpen", userMsg.Text);
        Assert.Contains(msgs, m => m.IsInternal && m.Text == "[borttagen] verkar irriterad");
        Assert.Contains(msgs, m => m.Text == "Mvh [borttagen]"); // "A. Lovelace" (kontaktnamn i mejlärendet)
    }

    [Fact]
    public async Task Anonymisering_SchemalagdaAtgarder_OutfordaRaderasUtfordaRensas()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var actions = await check.SupportTicketScheduledActions.ToListAsync();
        var kvar = Assert.Single(actions);
        Assert.True(kvar.Executed);
        Assert.Equal("Skickat till [borttagen]", kvar.Text);
    }

    [Fact]
    public async Task Anonymisering_NyAnvandareNotisUnderAdminensUserId_ScrubbasMenRadenBehalls()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var adminLogs = await check.NotificationDeliveryLogs.Where(l => l.UserId == b.Admin.Id && l.Subject == "Ny användare").ToListAsync();
        var log = Assert.Single(adminLogs);
        Assert.Equal("[borttagen] ([borttagen]) skapade ett konto", log.Body);
    }

    [Fact]
    public async Task Anonymisering_EgnaLeveransloggar_BehallsMenPushEndpointErsatts()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var own = Assert.Single(await check.NotificationDeliveryLogs.Where(l => l.UserId == ada.Id).ToListAsync());
        Assert.Equal("[borttagen]", own.Recipient);
        Assert.Equal("2 nya händelser", own.Body); // ingen persondata i texten → orörd
    }

    [Fact]
    public async Task Anonymisering_AktivitetsloggBehallsMedUserIdPseudonymMenNamnOchAnvandarensIpBorta()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var logs = await check.AdminActivityLogs.ToListAsync();
        Assert.Equal(2, logs.Count); // raderna finns kvar (ansvarsskyldighet)

        var reg = logs.Single(l => l.Rubrik == "Ny registrering");
        Assert.Equal("[borttagen] — via Lösenord", reg.Detalj);
        Assert.Null(reg.Ip);    // System-händelse: IP:n var användarens egen
        Assert.Null(reg.Enhet);

        var spärr = logs.Single(l => l.Rubrik.StartsWith("Konto spärrat"));
        Assert.Equal("Konto spärrat — [borttagen]", spärr.Rubrik);
        Assert.Equal("Sture Admin", spärr.Vem);          // adminens namn rörs inte
        Assert.Equal("198.51.100.1", spärr.Ip);          // adminens IP rörs inte
        Assert.Equal(ada.Id.ToString(), spärr.AngraAnvandareId); // pseudonymen behålls
    }

    [Fact]
    public async Task Anonymisering_PersonalSomAktor_FarNamnetOchEgenIpBortrensat()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var staff = new User { Name = "Sven Support", Email = "sven@samhallsinformation.se", PasswordHash = "x", Role = "Support", IsActive = false, DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-1) };
        db.Users.Add(staff);
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Sven Support", Typ = "Ärende", Rubrik = "Ärende besvarat", Detalj = "SUP-0001", Ip = "192.0.2.44", Enhet = "SvenBrowser" });
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Sture Admin", Typ = "Ärende", Rubrik = "Ärende besvarat", Detalj = "SUP-0002", Ip = "198.51.100.1" });
        await db.SaveChangesAsync();

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var logs = await check.AdminActivityLogs.ToListAsync();
        Assert.DoesNotContain(logs, l => l.Vem == "Sven Support");
        var sven = logs.Single(l => l.Vem == "[borttagen]");
        Assert.Null(sven.Ip);
        Assert.Equal("SUP-0001", sven.Detalj);
        Assert.Equal("198.51.100.1", logs.Single(l => l.Vem == "Sture Admin").Ip);
    }

    [Fact]
    public async Task Anonymisering_InstallningsloggBehallsMenPersondataVardenRedigeras()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var rows = await check.UserSettingAuditLogs.Where(l => l.UserId == ada.Id).ToListAsync();
        Assert.Equal(5, rows.Count); // alla rader kvar, UserId = pseudonym

        var name = rows.Single(r => r.Setting == "name");
        Assert.Equal(("[borttagen]", "[borttagen]"), (name.OldValue, name.NewValue));
        var email = rows.Single(r => r.Setting == "email");
        Assert.Equal(("[borttagen]", "[borttagen]"), (email.OldValue, email.NewValue));
        var polis = rows.Single(r => r.Setting == "polisen_bevakning_skapad");
        Assert.Null(polis.OldValue);
        Assert.Equal("[borttagen]", polis.NewValue);
        var pw = rows.Single(r => r.Setting == "password");
        Assert.Null(pw.OldValue);
        var notiser = rows.Single(r => r.Setting == "notiser"); // ingen persondata → orörd
        Assert.Equal(("false", "true"), (notiser.OldValue, notiser.NewValue));
    }

    [Fact]
    public async Task Anonymisering_EventShareLog_UserIdNollasMenRadenBehalls()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        var share = Assert.Single(await check.EventShareLogs.ToListAsync());
        Assert.Null(share.UserId);
    }

    [Fact]
    public async Task Anonymisering_AndraAnvandaresData_ArOrord()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        // Bertil (ej schemalagd för radering) seedas FÖRE Ada. Hans rader ska vara byte-för-byte lika efteråt.
        await SeedPersonAsync(db, b, Bertil, dueForDeletion: false);
        // Rader hos andra som råkar likna: "Adam" innehåller "Ada" men är inte samma ord.
        db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog { UserId = b.Admin.Id, Channel = "push", Recipient = "x", Subject = "Ny användare", Body = "Adam Andersson (adam@example.com) skapade ett konto" });
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Sture Admin", Typ = "Konto", Rubrik = "Konto spärrat — Adam Andersson", Detalj = "" });
        await db.SaveChangesAsync();
        var before = Snapshot(db);

        await SeedPersonAsync(db, b, Ada);
        await RunAsync(db);

        var after = Snapshot(db);
        foreach (var (key, value) in before)
        {
            Assert.True(after.ContainsKey(key), $"Raden {key} försvann");
            Assert.Equal(value, after[key]);
        }
        Assert.Contains("Bertil Bergman", string.Join('\n', after.Values)); // Bertils uppgifter finns kvar
        Assert.Contains("Adam Andersson (adam@example.com)", string.Join('\n', after.Values));
    }

    [Fact]
    public async Task Anonymisering_KorningTvaGanger_GerSammaResultat()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        await SeedPersonAsync(db, b, Ada);

        await RunAsync(db, expected: 1);
        var efterForsta = Snapshot(db);

        await RunAsync(db, expected: 0); // inget kvar att göra
        Assert.Equal(efterForsta, Snapshot(db));
    }

    [Fact]
    public async Task Anonymisering_DirektAnropTvaGanger_AndrarInteNagot()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);

        await UserAnonymizer.AnonymizeAsync(db, ada.Id, DateTime.UtcNow);
        var efterForsta = Snapshot(db);
        await UserAnonymizer.AnonymizeAsync(db, ada.Id, DateTime.UtcNow.AddHours(1));

        Assert.Equal(efterForsta, Snapshot(db)); // inte ens DeletedAt flyttas
    }

    [Fact]
    public async Task Anonymisering_FelMittIRullarTillbakaAllt_OchMarkerarInteKontotSomKlart()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);
        var before = Snapshot(db);

        // Databasen vägrar uppdatera aktivitetsloggen — det steget kommer EFTER att enheter/tokens redan raderats.
        await db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER fail_log BEFORE UPDATE ON \"AdminActivityLogs\" BEGIN SELECT RAISE(ABORT, 'simulerat fel'); END;");

        await RunAsync(db, expected: 0);

        // Allt är som förut: raderingarna rullades tillbaka, inget scrubbat, kontot inte markerat som klart.
        Assert.Equal(before, Snapshot(db));
        using (var check = TestDb.CreateSecondContext(db))
        {
            Assert.Null((await check.Users.SingleAsync(u => u.Id == ada.Id)).DeletedAt);
            Assert.True(await check.UserDevices.AnyAsync(d => d.UserId == ada.Id));
        }

        // Nästa cykel, felet borta → det lyckas.
        await db.Database.ExecuteSqlRawAsync("DROP TRIGGER fail_log;");
        await RunAsync(db, expected: 1);
        using var after = TestDb.CreateSecondContext(db);
        Assert.NotNull((await after.Users.SingleAsync(u => u.Id == ada.Id)).DeletedAt);
        Assert.False(await after.UserDevices.AnyAsync(d => d.UserId == ada.Id));
    }

    [Fact]
    public async Task Anonymisering_FelHosEnAnvandare_FallerInteBatchenEllerSmittarNastaAnvandare()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        // "Alfa" går sönder sent (efter att ärenden redan ändrats i change trackern), "Omega" är frisk.
        var alfa = new Person("Alfa Testsson", "alfa@example.com", "alfa.g@example.com", "Alf T", "alfa", "203.0.113.1");
        var omega = new Person("Omega Testsson", "omega@example.com", "omega.g@example.com", "Ome T", "omega", "203.0.113.2");
        var alfaUser = await SeedPersonAsync(db, b, alfa);
        var omegaUser = await SeedPersonAsync(db, b, omega);
        await db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER fail_alfa BEFORE UPDATE ON \"AdminActivityLogs\" WHEN OLD.\"Rubrik\" LIKE '%Alfa%' BEGIN SELECT RAISE(ABORT, 'simulerat fel'); END;");

        var done = await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db); // får inte kasta

        Assert.Equal(1, done);
        using var check = TestDb.CreateSecondContext(db);
        var a = await check.Users.SingleAsync(u => u.Id == alfaUser.Id);
        var o = await check.Users.SingleAsync(u => u.Id == omegaUser.Id);
        Assert.Null(a.DeletedAt);
        Assert.Equal("Alfa Testsson", a.Name);
        Assert.NotNull(o.DeletedAt);
        Assert.Equal("Raderad användare", o.Name);

        // Smittar inte: Alfas ärende ändrades i trackern innan felet, men skrevs aldrig när Omega sparades.
        var alfaTicket = await check.SupportTickets.SingleAsync(t => t.CreatedByUserId == alfaUser.Id);
        Assert.Equal("alfa@example.com", alfaTicket.ContactEmail);
        Assert.True(await check.UserDevices.AnyAsync(d => d.UserId == alfaUser.Id));
        Assert.False(await check.UserDevices.AnyAsync(d => d.UserId == omegaUser.Id));
    }

    [Fact]
    public async Task Anonymisering_HistoriskaAdresserOchNamn_FranInstallningsloggenRensasOckssa()
    {
        using var db = TestDb.Create();
        var b = await SeedBaseAsync(db);
        var ada = await SeedPersonAsync(db, b, Ada);
        // En gammal adress som bara finns i ett äldre ärendemeddelande och i en admin-notering.
        var t = await db.SupportTickets.FirstAsync(x => x.CreatedByUserId == ada.Id);
        db.SupportTicketMessages.Add(new SupportTicketMessage { TicketId = t.Id, SenderType = "support", AuthorUserId = b.Admin.Id, Text = $"Vi såg också {AdaOldEmail} och {AdaOldName}" });
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Sture Admin", Typ = "Konto", Rubrik = "Notering", Detalj = $"Tidigare känd som {AdaOldName}, {AdaOldEmail}" });
        await db.SaveChangesAsync();

        await RunAsync(db);

        foreach (var (column, value) in AllTextValues(db))
        {
            Assert.DoesNotContain(AdaOldEmail, value, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(AdaOldName, value, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Anonymisering_NamnSomOrdDelSkrivsInteOver_AdamBlirInteAdaBorttagen()
    {
        using var db = TestDb.Create();
        var u = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", IsActive = false, DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-1) };
        db.Users.Add(u);
        db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog { UserId = u.Id, Channel = "push", Subject = "s", Body = "Adam och Ada och ADA." });
        await db.SaveChangesAsync();

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        Assert.Equal("Adam och [borttagen] och [borttagen].", (await check.NotificationDeliveryLogs.SingleAsync()).Body);
    }

    [Fact]
    public async Task Anonymisering_GenericaNamn_AnvandsInteSomSokterm()
    {
        using var db = TestDb.Create();
        var u = new User { Name = "Support", Email = "s@example.com", PasswordHash = "x", IsActive = false, DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-1) };
        db.Users.Add(u);
        db.AdminActivityLogs.Add(new AdminActivityLog { AktörTyp = "Admin", Vem = "Admin", Rubrik = "Kontakta Support vid frågor", Detalj = "" });
        await db.SaveChangesAsync();

        await RunAsync(db);

        using var check = TestDb.CreateSecondContext(db);
        Assert.Equal("Kontakta Support vid frågor", (await check.AdminActivityLogs.SingleAsync()).Rubrik);
    }
}
