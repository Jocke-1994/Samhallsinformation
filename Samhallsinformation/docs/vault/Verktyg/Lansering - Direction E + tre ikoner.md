---
typ: verktyg
status: pagaende  # giltiga värden: att-gora | pagaende | klart
---

# Lansering — Direction E + tre ikoner (Bevakning/Sparat/Dela)

`Checklista-innan-lansering.md` kördes för första gången mot ett riktigt
funktionspaket 2026-09-13, på din begäran ("vi bör följa den rutin vi har
satt upp... nu har vi ju inte ens en anteckning för något av detta").
Bekräftar det du själv misstänkte: ingen sådan anteckning fanns innan nu.

Paketet: händelsekortets tre ikoner (🔔 Bevakning/`kallor_polisen_filter`,
🔖 Sparat/`flode_sparat`, 🔗 Dela/`flode_dela`) plus den nya mobila
kortlayouten (Direction E, se `Ideer/Mobil-design-handelsekort.md`) —
diskuterade och mockade tillsammans (se
https://claude.ai/code/artifact/828719bf-2216-47b2-9537-6d549051f323),
men olika långt komna var för sig. **Inget av detta aktiveras i
produktion som en följd av den här genomgången** — det är uttryckligen
inte syftet, bara en statuskoll innan det blir aktuellt.

## 1. Testad?
- **Bevakning:** Ja, live i produktion av dig själv (`Beslut - Polisen-
  bevakningar egna tester.md`, stängt 2026-09-13) — 3 pushaviseringar
  mottagna. Backend har enhetstester.
- **Sparat:** Enhetstestad + Playwright vid byggtillfället (PR #380/384/
  385, session 25). Ingen färsk live-verifiering i produktion.
- **Dela:** Enhetstestad (backend), förhandsvisad lokalt i mockläge på
  desktop. **Inte testad live mot en riktig backend, och inte testad på
  en riktig mobil** — vare sig `navigator.share()` (som är själva poängen
  på mobil) eller clipboard-fallbacken på desktop.
- **Direction E (layouten):** Bara mockad i Artifact, ingen kod skriven.

## 2. Admin-detaljvy — syns OCH går att ändra?
- **Bevakning:** Ja — läs+skriv (`Anvandarhantering-admin.md`).
- **Sparat:** Läs+ta bort. Ingen "lägg till å användarens vägnar", men
  bedömt tillräckligt (samma nivå som andra läs+ta-bort-ytor).
- **Dela:** **Nej — ingen admin-synlighet alls.** En användare som
  kontaktar supporten om delningsfunktionen ("jag delade men det hände
  inget") går inte att felsöka via admin idag. Gap, inte byggt.
- **Direction E:** N/A, ren layoutfråga.

## 3. Rutiner för hur funktionen ska användas (av användaren)
- **Bevakning:** Ja — dokumenterad väg via Mina källor.
- **Sparat:** Ingen egen Rutiner-not, men UI:t är självförklarande
  (bokmärkesikon).
- **Dela:** Ingen Rutiner-not. Sannolikt inte nödvändigt (en delknapp
  behöver knappast en användarrutin), men inte uttryckligen bedömt.
- **Direction E:** N/A.

## 4. Rutiner för admin/support — hantera inkommande frågor
- **Bevakning:** Ja — `Rutiner/Konto/Push-installningar.md` täcker push-
  delen. Ingen specifik "en bevakning matchar inte som väntat"-rutin.
- **Sparat:** Ingen rutin.
- **Dela:** Ingen rutin — och eftersom punkt 2 (admin-insyn) saknas helt
  skulle support inte ens ha data att felsöka med idag.
- **Direction E:** N/A.

## 5. FAQ-info
- **Bevakning:** `FAQ/FAQ - Polisen-bevakningar.md` finns i valvet men är
  **tom** ("fyll i frågan/svaret när det finns") — status `pausad`.
- **Sparat:** `FAQ/FAQ - Hur sparar jag en handelse.md` finns.
- **Dela:** Ingen FAQ-not alls.
- Ingen av dessa tre är inlagda som riktiga poster i FAQ-databasen
  (`FaqItems`) — bara vault-anteckningar om innehåll, om ens det.

## 6. Kundtjänstbot-info
Ingen av de tre funktionerna är beskrivna för kundtjänstboten. Samma
mönster som FAQ-synken (`Ideer/FAQ-synk-kundtjanstbot.md`) — när/om
kundtjänstboten ska kunna svara på frågor om Bevakning/Sparat/Dela
krävs samma sorts arbete som gjordes där.

## 7. Avstängningsbar (feature-flag)?
Ja, alla tre — `kallor_polisen_filter`, `flode_sparat`, `flode_dela`.

**Rättelse 2026-09-13 (upptäckt av dig, inte av min ursprungliga
genomgång):** min första kontroll kollade bara kodens `defaultAktiv` i
`featureFlags.ts`, inte den faktiska admin-overriden i produktion. Live
kontroll mot `GET /api/feature-flags` visar att `kallor_polisen_filter`
faktiskt har en override satt till `true` — **Bevakningar är alltså
redan LIVE i produktion**, inte avstängd som jag skrev här. `flode_sparat`
och `flode_dela` har ingen override och är fortfarande faktiskt av.
Lärdom: kontrollera alltid den EFFEKTIVA statusen (default + override),
aldrig bara kodens default, när frågan är "är det här live nu".

## 8. Loggad (UserSettingAuditLog för kontoändringar)?
- **Bevakning:** Ja — skapad/ändrad/borttagen loggas (session 42).
- **Sparat:** Nej — att spara/ta bort en händelse loggas inte i
  Inställningshistoriken. Troligen rätt bedömning (det är innehålls-
  interaktion, inte en kontoinställning), men aldrig uttryckligen beslutat.
- **Dela:** Nej, av samma skäl som Sparat — och rätt bedömning av samma
  anledning: `EventShareLog` är en aktivitetslogg (vad klickades, av vem
  om inloggad), inte en inställningsändring.

## 9. GDPR-täckt?
- **Bevakning:** Ja — `PolisenBevakningar` i `ExportMe`.
- **Sparat:** Ja — `SparadeHandelser` i `ExportMe`.
- **Dela:** **Var NEJ, hittat och fixat under den här genomgången**
  2026-09-13 — `EventShareLog` saknades i GDPR-exporten trots att den
  kopplas mot användarens id vid inloggad delning. `DeladeHandelser`
  tillagt i `AuthController.ExportMe`, ny test, på `feat/dela-handelse`
  (PR #574, öppen). Exakt den sortens lucka punkt 9 är till för att fånga.

## 10. Mobiltestad?
Nej, ingen av de tre är verifierad på en riktig mobil i sitt nuvarande
skede. Bevakning har körts live i produktion (vilket innefattar mobil
push), men UI:t för att hantera bevakningar är inte specifikt mobil-
granskat nyligen. Direction E är bara mockad, inte byggd — mobiltest är
förstås inte aktuellt förrän den kodas.

## 11. Ärligt tomt-läge?
- **Bevakning:** Ja (noll bevakningar = oförändrat beteende, redan en
  medveten designprincip från session 35).
- **Sparat:** Antas ja (byggd med samma standard som övriga listor),
  inte omverifierad nu.
- **Dela:** N/A — ingen lista, bara en knapp.

## Sammanfattning
**Riktig statusuppdatering 2026-09-13: Bevakning är redan LIVE** (se
rättelsen under punkt 7) — inte längre bara "skarpt testad", faktiskt
påslagen för alla användare just nu. Sparat och Dela är fortfarande av.

**Riktiga gap hittade:** ingen admin-insyn i Dela (punkt 2/4), tom FAQ
för Bevakning och ingen FAQ alls för Sparat/Dela (punkt 5), ingen
kundtjänstbot-info för något av de tre (punkt 6), GDPR-luckan för Dela
(punkt 9 — redan fixad). Eftersom Bevakning nu är live väger den tomma
FAQ:n (`FAQ - Polisen-bevakningar.md`) och avsaknaden av admin-insyn i
Dela tyngre än när de skrevs — Bevakning är inte längre en framtida
flagga, den används på riktigt idag.

**Redan i ordning:** alla tre bakom avstängningsbara flaggor (punkt 7),
Bevakning och Sparat GDPR-täckta och (Bevakning) loggad. Bevakning är
dessutom redan skarpt testad av dig i produktion — och nu bekräftat
faktiskt aktiverad, inte bara testad.

**Ingen aktivering skedde som en följd av att SKRIVA den här
anteckningen** — Bevaknings-flaggan slogs på separat av dig, upptäckt
här via en live-kontroll, inte orsakad av den.

## Kopplat
- `Verktyg/Checklista-innan-lansering.md`
- `Ideer/Mobil-design-handelsekort.md`
- `Ideer/Dela händelse.md`
- `Beslut/Klara beslut/Beslut - Polisen-bevakningar egna tester.md`
- `Funktioner/Anvandarhantering-admin.md`
