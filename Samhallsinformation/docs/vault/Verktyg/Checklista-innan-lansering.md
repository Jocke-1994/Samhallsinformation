---
typ: verktyg
status: pagaende  # giltiga värden: att-gora | pagaende | klart — "pagaende" här betyder "levande, används löpande", inte "på väg att bli klar"
---

# Checklista — innan en ny funktion går live

"Live" = användare kan faktiskt använda den (flaggan/knappen synlig för
riktiga konton, inte bara i sandlådan). Formaliserad 2026-09-12 från en
tanke i `1. Öppna_tankar/Flöde ny idé.md`. Tänkt att gås igenom innan en
feature-flag slås på för alla, inte bara vid stora lanseringar.

## Din ursprungslista
1. Den ska vara testad
2. Om det är en funktion som kan slås av/på av en användare, ska den
   fungera i användarens admin-detaljvy — **exakt det som byggdes för
   push-inställningar 2026-09-12/13**, första riktiga tillämpningen av den
   här punkten. Note: läsläge byggdes först, men räckte inte i praktiken —
   en användare bad supporten ändra en inställning åt sig, och supporten
   hade inget sätt att göra det. Skrivrätt tillagd dagen efter, med en
   uttrycklig policy (i [[../Rutiner/Konto/Push-installningar]]): ändra
   bara när användaren SJÄLV bett om det. Lärdom att ta med framåt — punkt
   2 betyder troligen "syns OCH går att ändra", inte bara "syns"
3. Det ska finnas rutiner för hur den ska användas
4. Det ska finnas rutiner för admin/support hur man hanterar inkommande
   frågor
5. FAQ-info
6. Kundtjänstbot-info

## Fler punkter — alla bekräftade 2026-09-13
7. **Avstängningsbar** — ligger funktionen bakom en riktig feature-flag?
   Du håller helt med.
8. **Loggad** — skriver funktionens admin-relevanta händelser till
   Aktivitetsloggen? **Förtydligat:** menar `UserSettingAuditLog`
   (Inställningshistorik-fliken, per-användare) snarare än den delade
   Aktivitetsloggen — samma princip, olika tabell beroende på om
   ändringen rör EN användares konto (dit) eller är en admin/system-
   händelse (den delade loggen). Konkret, färskt exempel: när push-
   skrivrätten byggdes idag loggades varje faktisk ändring dit automatiskt
   (`push_enabled`, `push_nya_handelser`, `push_ny_version`,
   `ChangedBy="admin"`) — syns i användarens egen Inställningshistorik-flik
9. **GDPR-täckt** — om funktionen lagrar ny persondata, är den med i
   GDPR-exporten? **Du föreslår en egen rutin bara för GDPR-koll** —
   sparat som en ny idé nedan, inte byggd än
10. **Mobiltestad** — bekräftat, UI är troligen det viktigaste på mobil.
    Du noterar att användarrapporter kan hjälpa fånga det som missas
11. **Ärligt tomt-läge** — bekräftat, bra att ha med

## Struktur — besvarat 2026-09-13
Den här blir specifikt för LANSERING. Du föreslog att bygga ut med tre
till, separata dokument (inte en gemensam megachecklista): nya idéer,
tillfälligt avstängda befintliga funktioner, och utveckling av redan
befintliga funktioner. Bra idé — **inte byggda än**, bygg dem när/om
behovet faktiskt uppstår (samma princip som redan gäller för Rutiner:
gissa inte i förväg).

## Ny idé, inte byggd: egen GDPR-checklista
Från punkt 9 ovan — en fristående, separat rutin/checklista för att
verifiera att en ny funktion som rör persondata faktiskt är GDPR-täckt
(export, radering, syfte, lagringstid). Värd sitt eget dokument snarare
än att bara vara en rad här, eftersom GDPR-frågor tenderar att kräva mer
eftertanke än resten av listan.

## Kopplat
- [[../1. Öppna_tankar/Flöde ny idé|Flöde ny idé]] — ursprungstanken
- [[../Funktioner/Anvandarhantering-admin]] — punkt 2 tillämpad idag
- [[../Rutiner/Konto/Push-installningar]] — policyn för punkt 2:s
  skrivrätt i praktiken
- [[Lansering - Direction E + tre ikoner]] — första gången hela
  checklistan tillämpad mot ett riktigt funktionspaket (2026-09-13),
  inte bara en enskild punkt
