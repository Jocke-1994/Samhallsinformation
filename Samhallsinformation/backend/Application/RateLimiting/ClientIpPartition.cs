namespace Samhallsinformation.Application.RateLimiting;

using System.Net;
using System.Net.Sockets;

/// <summary>
/// Partitionsnyckel för rate limiting per klient-IP (V2-10, E1 #1). En enskild kund har normalt
/// ett helt IPv6-/64 och kan välja bland 2^64 adresser — partitionerar man på hela adressen kan
/// den kringgå gränsen genom att rotera adress. Därför normaliseras IPv6 till sitt /64-prefix.
/// IPv4 är oförändrad, och IPv4-mappade IPv6-adresser (::ffff:a.b.c.d, som dual-stack-lyssnare ger)
/// blir sin IPv4-adress så samma klient inte får två räknare.
/// </summary>
public static class ClientIpPartition
{
    public static string KeyFor(IPAddress? address)
    {
        if (address == null) return "unknown";

        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
            return address.ToString();

        Span<byte> bytes = stackalloc byte[16];
        address.TryWriteBytes(bytes, out _);
        bytes[8..].Clear(); // behåll bara de första 64 bitarna
        return new IPAddress(bytes).ToString() + "/64";
    }
}
