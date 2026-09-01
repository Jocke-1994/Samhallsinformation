namespace Samhallsinformation.Application.Aktivitetslogg;

// Delad loggningstjänst för alla admin/system-händelser (#491 wave 1).
// Fångar Vem/Ip/Enhet automatiskt från den pågående HTTP-förfrågan — ett
// call-site behöver bara ange VAD som hände, inte VEM eller VARIFRÅN.
public interface IAktivitetsloggService
{
    Task LogAsync(
        string aktörTyp,
        string typ,
        string rubrik,
        string detalj,
        string? gammaltVärde = null,
        string? nyttVärde = null,
        bool test = false,
        Guid? relateratÄrendeId = null);
}
