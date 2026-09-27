---
typ: rå-tanke
källa: "V4-5, uppföljning av enhet-1/enhet-4/enhet-6 'under rangordningsgränsen', 2026-09-27"
---

# Kodgranskning-backlog — Admin-API validering och dataintegritet

Rå tanke, del av V4-5 (se "Auth, sessioner och inloggning" för bakgrund).
Verifierat mot NUVARANDE kod 2026-09-27.

## Notification-log läcker fortfarande push-endpoints

**`AdminUserDetailsController.GetNotificationLog` (Admin+Support) returnerar
fortfarande `Recipient` rakt av** — för push-kanalen är det hela enhetens
`Endpoint` (en känslig prenumerations-URL), vilket motsäger en kommentar i
samma fil (`PushDispatcher.cs`) om att Endpoint/P256dh/Auth avsiktligt INTE
ska exponeras. `PushController.ListLogs` har redan mönstret för en trunkerad
förhandsvisning — samma mönster borde återanvändas här. Det här är samma
punkt som nämns rakt av i FIXPLAN:s egen V4-5-exempellista.

*(enhet-1, "Admin/Support")*

## Paginering — delvis åtgärdat

`EventsController.GetEvents`/`SearchPublic` klampar numera `page` till
minst 1 (`if (page < 1) page = 1`) — det löser overflow-scenariot
((page-1)*pageSize med page nära int.MaxValue). **Kvarstår:** `pageSize`
klampas fortfarande bara UPPÅT (`if (pageSize > 100) pageSize = 100`) — ett
negativt `pageSize` ger fortfarande en negativ `Take()` → 500 hos Npgsql.
Gäller `GetEvents`, `SearchPublic` och sannolikt `AdminEventSearchController`
(ej omkontrollerad separat). Samma mönster nämns i FIXPLAN:s egen
V4-5-exempellista ("page/pageSize klampas ej") — nu bara halvt sant, värt
att stänga helt med en `pageSize < 1`-koll.

*(enhet-1, "Publika endpoints")*

## Publika/anonyma endpoints, återstående

- `EventsController.GetEvent` och `GetLinkStatus` returnerar fortfarande
  händelser från OPUBLICERADE (sandlåde-/test-)källor om man känner till
  ID:t — till skillnad från `GetEvents`/`SearchPublic`, som redan filtrerar
  på `IsPublished`.
- `GetLinkStatus` är fortfarande helt anonym, utan rate limit, och gör
  fortfarande en utgående nätverksanrop per anrop (8 s timeout, följer
  redirects) mot `evt.Url` — kan användas för att generera trafik mot
  myndighetskällorna eller (smalt) som SSRF-yta om ett inläst flöde
  innehåller en omdirigerande/intern länk.
- `LogShare` är fortfarande helt anonym, utan rate limit och utan koll att
  `id` faktiskt motsvarar en existerande händelse — obegränsad tillväxt av
  `EventShareLogs` med påhittade Guid:s (ingen FK), förgiftad
  delningsstatistik.
- `SearchPublic` escapar fortfarande inte `%`/`_` i `sokord`/`geography`
  (wildcard-injektion via `EF.Functions.Like`), och ett brett sökord ger
  fortfarande en full tabellskanning av `Content` — bara skyddad av
  `eventssearch`-rate-limiten (30/min/IP), inte av någon indexering eller
  sanering.

*(enhet-1, "Publika endpoints")*

## Push-dispatcher: IsPublished — redan åtgärdat

Bra nyhet: `PushDispatcher.DispatchNewEventsAsync` kollar numera
`source.IsPublished` explicit och returnerar tidigt om källan inte är
publicerad — det ursprungliga fyndet ("push oavsett publiceringsstatus") är
löst. (Se separat fil om push för `ShortName`-bugg som återstår i samma
metod.)

## Existens-kontroller saknas fortfarande på flera admin-skrivvägar

`AdminUserDetailsController`:
- `SaveEvent` skapar fortfarande en `UserSavedEvent`-rad utan att
  kontrollera att `req.EventId` faktiskt existerar (FK-fel → 500 i stället
  för ett tydligt 404), och `SaveEvent`/`UnsaveEvent` saknar fortfarande
  audit-logg i `UserSettingAuditLog` medan systerfunktionerna (bevakningar,
  källaktivering) redan loggar.
- `SetUserSourceActive` kollar fortfarande inte att `sourceId` existerar
  eller är publicerad innan den skapar/uppdaterar en
  `UserSourcePreference`-rad.
- Positivt: dessa endpoints är numera `[Authorize(Roles = AdminRoller.Admin)]`
  (inte längre Admin+Support) — den delen av det ursprungliga fyndet
  ("Supportrollen kan ändra vilken användares push-inställningar") verkar
  redan åtgärdad.

*(enhet-1 "Admin/Support", enhet-4 "Användarcontrollers")*

## Fritextfält och statuskoder utan gräns (admin/support-ytor)

Samlingsfynd — alla admin/support-only, låg risk (betrodda roller) men
"saknad gräns" i egen rätt:

- `AdminActivityLogController.CreateLogEntry` (Admin+Support): `Typ`,
  `Rubrik`, `Detalj`, `AktivVy` är fortfarande godtyckliga strängar utan
  längdgräns eller whitelist — en Support-användare kan fortfarande skriva
  rader med en `Typ`/`Rubrik` som ser ut som en systemrad. `MarkUndone`
  sätter fortfarande bara `Ångrad = true` utan att koppla det till att
  något faktiskt ångrats.
- `FaqController`: fortfarande ingen validering av `FlagKey` mot kända
  flaggor eller längdgräns på `Fraga`/`Svar`.
- `AdminFeatureIdeaController`: `SetStage` tar fortfarande en godtycklig
  `Stage`-sträng (kan krascha frontendens stadie-uppslag på samma sätt som
  severity/typ-fyndet nedan); `UpdateIdea` skriver fortfarande alltid
  `FlagKey = req.FlagKey` (ett utelämnat fält i payloaden RADERAR
  kopplingen till flaggan — frontend (`api/featureIdeas.ts`) måste komma
  ihåg att alltid skicka fältet); `DeleteIdea` lämnar fortfarande
  `RedoAttLanseras=true` kvar på flaggan efter att idén tagits bort.
- `SourcesController.CreateSource`: `Type` (enum) tar fortfarande vilket
  heltal som helst, `Url` har fortfarande ingen schema-kontroll (samma
  SSRF-karaktär som ingestor-fyndet i push-filen), tomt `Name` tillåts.

*(enhet-4, "Admin – validering och statuskoder")*

## Okänd severity/typ ger fortfarande vit skärm — samma bugg på fem ställen

`SEVERITY_CONFIG[event.severity]`/`TYP_CONFIG[p.typ]`-uppslag utan
`?? fallback` finns FORTFARANDE, oförändrat, på alla platser som redan
identifierades:

- `components/NewsFeed/NewsItem.tsx` (`SEVERITY_CONFIG[event.severity]`,
  ingen fallback — hela flödet vitnar om en händelse någonsin får en okänd
  severity)
- `pages/UppdateringarPage.tsx` (`TYP_CONFIG[p.typ]`, två ställen)
- `components/Profile/Uppdateringar.tsx` (`TYP_CONFIG[p.typ]`, tre ställen)

Latent idag (alla nuvarande ingestorers `MapSeverity`/`DefaultSeverity` ger
bara de tre kända värdena), men en enda rad `?? 'Bra att veta'`/
`?? TYPE_FALLBACK` per ställe eliminerar krasch-risken permanent — billig
fix, värt att göra proaktivt innan nästa ingestor/typ läggs till.

*(enhet-4 fynd-referens, enhet-6, enhet-7 — samma bugg, tre filer)*

## StatsController: samma vecko-buggmönster som redan rättats en gång

`StatsController.cs` bygger fortfarande "senaste 7 dagarna"/dagsstapeln som
`Enumerable.Range(0, 7)` från `now.AddDays(-7).Date` — dagarna −7…−1,
**exkluderar idag**. `AdminIngestorLogController` har redan den korrekta
varianten (`-(days - 1)`) för samma sorts fråga. En-rads-fix, bara inte
gjord här ännu.

*(enhet-6, "Datum/tid")*

## Support-inbox, återstående

- `AdminSupportController.Reply`: ett mejlfel loggas fortfarande bara
  internt (`_logger.LogError`) — agenten får `200 OK` från endpointen och
  ser ingenting i svaret om medborgaren faktiskt INTE fick svaret (inget
  `emailSent`-fält). Tom `Text` godkänns fortfarande (skulle skicka ett tomt
  mejl om `IsInternal=false`).
  Refaktorerad sedan granskningen till en delad `SupportReplyDelivery`-
  tjänst — samma beteende, bara på ett nytt ställe.
- `GetTickets` saknar fortfarande paginering och returnerar fortfarande alla
  ärenden (inkl. arkiverade) med `ContactEmail`.
- `Assign` med ett okänt `UserId` ger fortfarande ett FK-brott (500) i
  stället för ett tydligt fel, och accepterar fortfarande vilken användare
  som helst (inte bara en agent-roll).

*(enhet-4, "Admin – validering och statuskoder")*

## Övriga mindre dataintegritetsfynd

- `UserSourcesController.SaveSources`: audit-loggen skrivs fortfarande bara
  för REDAN existerande prefs — en helt ny prenumeration loggas inte i
  `UserSettingAuditLog`.
- `UserPolisenBevakningController`: en tom lista `[]` betyder fortfarande
  "matchar ingenting" i `PolisenBevakningMatcher.Matches`, medan `null`
  betyder "matchar allt" — en bevakning som råkar sparas med `[]` gör att
  användaren tyst slutar få Polisen-händelser helt, utan varning i UI:t.
- `UserPreference`-tabellen (`Models/UserPreference.cs`, `UserId` är
  `string` utan FK) ser fortfarande ut att vara död kod — ingen aktiv
  controller läser eller skriver den (bara migrationshistorik och GDPR-
  anonymiseraren, som städar den vid kontoradering). Kandidat att ta bort
  helt, om ingen frontend-yta visar sig bero på den vid en snabb sökning.

*(enhet-4 "Användarcontrollers", enhet-2 "Övriga observationer")*

Ursprung: `docs/code-review/enhet-1.md` §"Övriga observationer",
`enhet-2.md` §"Övriga observationer", `enhet-4.md` §"Under
rangordningsgränsen", `enhet-6.md` §"Under rangordningsgränsen".
