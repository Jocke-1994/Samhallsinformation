namespace Samhallsinformation.Application.Monitoring;

/// <summary>
/// Trösklar för övervakningsreglerna. Läses från config/env (t.ex. Railway-variabler) med de
/// defaultvärden som beslutades i V1-9; ogiltiga eller icke-positiva värden ger default.
/// </summary>
public sealed class MonitoringOptions
{
    /// <summary>MONITORING_USERS_THRESHOLD — antal registrerade (icke-raderade) användare som utlöser alt C-larmet.</summary>
    public int UsersThreshold { get; init; } = 500;

    /// <summary>MONITORING_SOURCE_FAIL_STREAK — så många misslyckade cykler i rad (IngestorRunLog) ger larm.</summary>
    public int SourceFailStreak { get; init; } = 3;

    /// <summary>
    /// MONITORING_SOURCE_STALE_MINUTES — en aktiv, publicerad källa som inte hämtats på så här länge larmar.
    /// Ingestorn kör var 5:e minut; 30 minuter = 6 cykler, tillräckligt för en långsam cykel eller en omstart.
    /// </summary>
    public int SourceStaleMinutes { get; init; } = 30;

    // push_failures — inte konfigurerbart via env i v1.
    public int PushWindowHours     { get; init; } = 6;
    public int PushMinAttempts     { get; init; } = 10;
    public double PushFailureShare { get; init; } = 0.5;

    public static MonitoringOptions FromConfiguration(IConfiguration config) => new()
    {
        UsersThreshold     = Positive(config["MONITORING_USERS_THRESHOLD"],     500),
        SourceFailStreak   = Positive(config["MONITORING_SOURCE_FAIL_STREAK"],    3),
        SourceStaleMinutes = Positive(config["MONITORING_SOURCE_STALE_MINUTES"], 30),
    };

    private static int Positive(string? raw, int fallback) =>
        int.TryParse(raw, out var v) && v > 0 ? v : fallback;
}
