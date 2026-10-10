---
typ: index
uppdaterad: 2026-10-10
---

# Öppna frågor — allt som väntar på ditt svar, på ett ställe

Ett enda ställe att kolla, istället för att behöva komma ihåg vilka
anteckningar som har en "Öppna frågor"-sektion. **Regel framöver:**
varje gång jag lägger en `## Öppna frågor`-sektion i en vault-not, lägger
jag samtidigt till en rad här. När du besvarar frågan i notens egen fil,
strimlar jag bort raden härifrån vid nästa genomgång — den här listan
ska bara innehålla det som GENUINT väntar på dig just nu.

## Väntar på ditt svar — aktiva frågor

- **[[../Ideer/Testmiljö|Testmiljö]]** — ny idé (2026-10-10): en skarp
  men osynlig vy av senaste versionen, bara synlig för Admin/framtida
  beta-testare. Flera grundläggande tekniska vägval olösta — separat
  deploy eller roll-styrd vy i befintlig drift, egen databas eller
  samma, vad en "vy" konkret innebär. Se notens Öppna frågor.

## Väntar på en åtgärd från dig (inte en fråga — allt är redan beslutat)

- **[[../Ideer/FAQ-synk-kundtjanstbot|FAQ-synk-kundtjanstbot]]** — vår
  halva byggd (PR #573). Ett färdigt meddelande att kopiera till
  kundtjänstbot-projektets Claude-session ligger klart i noten (punkt 4)
  — bara att byta ut produktions-URL:en och skicka när du vill
- **[[../Ideer/Kundtjanstbot-launch-readiness|Kundtjänstbot-launch-readiness]]**
  — ny, inför att öppna login/register publikt. Ett färdigt meddelande
  att kopiera till kundtjänstbot-projektets Claude-session ligger klart
  i noten — frågar om botens nuvarande osäkerhets-hantering/disclaimer
  och om `SupportEscalationUrl` konfigurerats för företag-id 8 (den
  allvarligaste delfrågan, hallucinationsrisken, är löst separat — se
  [[../Ideer/Kundtjanstbot-handelse-sok-api|Kundtjänstbot-handelse-sok-api]])

## Väntar på en åtgärd (beslutat 2026-10-04, inte byggt än)

- **[[../Ideer/Dela händelse|Dela händelse]]** — beslutat: enklare v1 av
  session 38:s idé. Kontakter/grupper-delning INOM appen är ett medvetet
  framtida steg ovanpå det redan byggda (OS-delningsmenyn), inte en
  separat idé.
- **[[../Verktyg/Schemalagd-lansering|Schemalagd lansering]]** — beslutat:
  två separata kryssrutor i schemaläggningsflödet — en för push (redan
  manuell knapp behålls för ad-hoc), en ny "Synas för besökare?" som
  styr en "Ny version"-banner via MaintenanceBanner-systemet.
  Utökat och UI godkänt 2026-10-08: annonsering i förväg, banderoll
  till de som berörs (alla eller bara inloggade, härlett från
  punkternas "Syns för"), FAQ-lista. Redo att byggas.
- **[[../Ideer/Geografiskt-platsfilter-besokare|Geografiskt
  platsfilter för besökare]]** — alla 14 scenarier beslutade, UI
  godkänd 2026-10-04 (Variant E, B+C-kombo, både desktop och mobil).
  Byggt i tre PR:ar (#675, #676 mergade, #677 öppen 2026-10-10) bakom
  flaggan `flode_platsfilter` (av). Väntar bara på #677s granskning,
  sen ett lanseringsbeslut (flagga på).

## Avvaktas medvetet, inte en aktiv fråga just nu
- **[[../Verktyg/Mobil-synk-Obsidian|Mobil-synk-Obsidian]]** — avvaktas,
  planen ligger kvar
- **[[../Ideer/Bottom bar (mobil)|Bottom bar (mobil)]]** — öppet, ingen
  brådska, fler kandidater än Sök/Bevakningar kan dyka upp
- **[[../Ideer/Uppdateringar-schemalagd-publicering|Uppdateringar
  schemalagd publicering]]** — beslutat 2026-10-03: avvaktar ett
  konkret behov innan push-koppling/djuplänk/förhandsprenumeration byggs

## Redan besvarade, väntar bara på att byggas eller ligga kvar avsiktligt
Inte en fråga till dig — bara saker som är beslutade men inte gjorda än.
Se [[_Prioritering]] för fullständig lista.
