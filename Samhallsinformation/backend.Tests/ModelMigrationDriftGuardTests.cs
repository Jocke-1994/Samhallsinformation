namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Xunit;

/// <summary>
/// Guard G2 (code review enhet 8, avsnitt 4): en modelländring utan en matchande migration
/// upptäcks inte annat än vid produktionsstart (<c>Program.cs</c> ignorerar avsiktligt
/// <c>PendingModelChangesWarning</c> för att inte krascha uppstarten på en känd, ofarlig avvikelse
/// — se kommentaren precis ovanför <c>MigrateAsync()</c>). Det gör den här länken i kedjan blind i
/// CI: en utvecklare som glömmer <c>dotnet ef migrations add</c> efter att ha ändrat en modellklass
/// får inget rött test förrän raden faktiskt läses/skrivs i produktion.
///
/// Enhet-8 flaggade detta som en osäker spike ("differ kan ge falska träffar mot ett
/// Npgsql-konfigurerat context, exakt API i EF 10 inte verifierat"). Verifierat här (V4-6a):
/// <c>Database.HasPendingModelChanges()</c> finns i EF Core 10 som en extension-metod på
/// <c>DatabaseFacade</c> (<c>Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions</c>),
/// fungerar mot SQLite utan någon skarp anslutning, och gav <c>false</c> mot dagens modell/migrationer
/// samt <c>true</c> när en ny mappad egenskap lades till på <c>User</c> manuellt utan migration
/// (manuellt verifierat under utveckling av det här testet, sedan återställt — ingen produktionskod
/// ändrad i den här PR:en). Alltså inte längre en osäker spike: pålitlig, billig, ingen DB krävs.
/// </summary>
public class ModelMigrationDriftGuardTests
{
    [Fact]
    public void CurrentModel_HasNoChangesPendingAMigration()
    {
        using var db = TestDb.Create();

        Assert.False(db.Database.HasPendingModelChanges(),
            "Modellen (Models/*.cs, AppDbContext) har ändrats utan att en ny migration lagts till. " +
            "Kör 'dotnet ef migrations add <Namn>' i backend/ innan den här PR:en är klar — annars " +
            "upptäcks inte avvikelsen förrän Program.cs läser PendingModelChangesWarning i produktion " +
            "(den varningen ignoreras avsiktligt där för att inte krascha uppstarten).");
    }
}
