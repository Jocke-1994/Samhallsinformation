---
kategori: ""
status: aktiv  # giltiga värden: aktiv | utkast | foraldrad
uppdaterad: 2026-11-02
---

# Lansera en ny funktion

Används när en funktion står i **🚀 Lanseringsklar** i pipelinen och ska ut
till riktiga användare. [[../../Verktyg/Checklista-innan-lansering|Checklistan innan lansering]]
svarar på *är funktionen redo?* Den här rutinen svarar på *hur släpper jag den, steg för steg?*

Skriven utifrån hur lanseringarna faktiskt gick i session 49–55 (inloggning,
Dela händelse, Platsfiltret, Schemalagd lansering).

**🤖 = kontrolleras automatiskt** av förhandsvisningen i Uppdateringar när den
är byggd ([[../../Ideer/Uppdateringar-forhandsvisning]]). Tills dess gör du de stegen själv.

---

## 1. Innan — är den redo?
- [ ] [[../../Verktyg/Checklista-innan-lansering|Checklistan innan lansering]] avklarad
- [ ] **Testa skarpt "bara för admin" först.** Slå på flaggan med synligheten
  *Endast admin* (Feature flags-sidan). Du ser funktionen mot riktig
  produktionsdata, ingen annan gör det. *Så testades Platsfiltret.*
- [ ] **Kolla flaggans faktiska läge**, inte vad koden säger. Feature flags-sidan
  i admin, eller `GET /api/feature-flags`. *Har lurat oss två gånger.*

## 2. Planera lanseringen — Admin → Uppdateringar → + Ny uppdatering
- [ ] **Titel** som en besökare förstår (inte ett tekniskt namn)
- [ ] **Punkter:** en per sak som ändras. Rätt typ (Ny funktion, Förbättring, …)
- [ ] **"Syns för" på varje punkt.** Rör den bara inloggade? Märk den
  *Endast inloggade*. 🤖 *Varnar om besökare inte ser något alls.*
- [ ] **Schemalägg** och kryssa i **flaggorna** som ska slås på vid lanseringen
- [ ] **Annonsera i förväg?** Då visas "Kommer snart" från det datumet
- [ ] **Push:** version + meddelande. Välj fas om annonsering är vald. 🤖 *Varnar om något saknas.*
- [ ] **Banderoll** om nyheten ska synas för alla som besöker sajten
- [ ] **Vad är nytt** om inloggade ska få rutan. 🤖 *Frågar om en "Ny funktion"-punkt saknar den.*
- [ ] **Titta på förhandsvisningen** i varje flik, som besökare OCH inloggad, och i båda faserna 🤖

## 3. Det runt omkring
- [ ] **FAQ:** formuläret listar frågor kopplade till flaggorna. Är de
  publicerade och stämmer texten? 🤖 *Påminner om de finns.*
- [ ] **Kundtjänstboten:** vet den om funktionen? Vår FAQ-endpoint visar bara
  frågor vars flagga är på (PR #573), men om boten faktiskt synkar mot den
  avgörs i kundtjänstbot-projektet. Se [[../../Ideer/FAQ-synk-kundtjanstbot]].
  Osäker? Fråga boten om funktionen efter lanseringen.
- [ ] **Extern kanal?** T.ex. ett LinkedIn-inlägg. Tajma det mot lanseringstiden
  (så gjordes inloggningen, session 49)

## 4. När lanseringen slagit in
- [ ] **Flaggan är faktiskt på** i produktion (samma koll som i steg 1)
- [ ] **Nyheter-sidan** visar uppdateringen, som utloggad
- [ ] **Pushen kom fram** till din egen telefon (om vald)
- [ ] **Aktivitetsloggen** visar flagg-aktiveringen

## 5. Efteråt — städa
- [ ] Pipelinen: flytta posten till **✅ Lanserad**
- [ ] Idé-noten i `Ideer/`: `status: lanserad`
- [ ] Skapa/uppdatera en not i `Funktioner/` (nu är det en riktig funktion)
- [ ] Ta bort eventuella rader i [[../../1. Öppna_tankar/Öppna frågor|Öppna frågor]]

## Om något går fel
- **Fel i funktionen:** stäng av flaggan i Feature flags. Allt annat (nyhet,
  banderoll) kan ligga kvar eller avpubliceras i Uppdateringar.
- **Fel i texten:** redigera uppdateringen. Pushen går inte att ta tillbaka,
  därför är steg 2 värt att ta på allvar.

## Teknisk plats
- Formulär: `frontend/src/components/Admin/AdminUppdateringar.tsx`
- Schemat körs av: `backend/Services/ScheduledReleaseBackgroundService.cs`
- Flaggor: `backend/Controllers/FeatureFlagsController.cs` (`/synlighet` = Endast admin)

## Kopplat
- [[../../Verktyg/Checklista-innan-lansering]]
- [[../../Verktyg/Schemalagd-lansering]]
- [[../../Ideer/Uppdateringar-forhandsvisning]]
- [[../../1. Öppna_tankar/Flöde ny idé|Flöde ny idé]] (pipeline-stegen)
