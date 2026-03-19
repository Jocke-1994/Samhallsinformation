namespace Samhallsinformation.Helpers;

using Samhallsinformation.Models;

public static class MetadataFallbacks
{
    public const string DefaultSeverity = "Bra att veta";

    public static void ApplyGeographyFallback(CanonicalEvent evt)
    {
        if (string.IsNullOrWhiteSpace(evt.Geography))
        {
            evt.Geography = null;
            evt.IsNational = true;
        }
    }

    public static void ApplySeverityFallback(CanonicalEvent evt)
    {
        if (string.IsNullOrWhiteSpace(evt.Severity))
        {
            evt.Severity = DefaultSeverity;
        }
    }

    public static void ApplyAll(CanonicalEvent evt)
    {
        ApplyGeographyFallback(evt);
        ApplySeverityFallback(evt);
    }
}
