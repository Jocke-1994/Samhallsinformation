---
status: planerad  # byggd på tre grenar 2026-11-11, inte pushad/mergad än
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Discord-servern (ingen UI i appen)"
kodPlats: "IAlertNotifier + DiscordAlertNotifier, .github/workflows/source-watch.yml, uptime.yml, ci-notify.yml"
flagKey: ""
sedan: "2026-11-11"
pausadVarfor: ""
fallgropar:
  - "Webhook-URL:er är hemligheter — klistra aldrig in dem i chatten, bara i Railway/GitHub-secrets"
  - "Trafikverkets portal är en SPA: rubriken finns inte i HTML:en, källbevakningen tar rubriken ur adressen"
  - "GitHub kan försena schemalagda körningar 5–15 min, så upptidskollen är en grov vakt"
---

# Discord-notiser

Notiser om drift, CI och källornas nyheter går till en Discord-server, så att
du slipper bevaka mejl från Trafikverket med flera och föra över informationen
manuellt. Idén kom från session 61 (2026-11-11), efter Trafikverkets mejl om
`TrafficFlow`.

## Status
Byggt och testat lokalt på tre separata grenar. **Inget är pushat.** Väntar på:
1. Discord-server + webhooks (se kanalerna nedan)
2. Secrets inlagda
3. Ok till push → `/code-review` på backend-grenen → en PR per gren
4. Efter merge: kör `uptime.yml` och `source-watch.yml` manuellt en gång
   (*Run workflow*). jq-delen som bygger Discord-meddelandet kunde inte
   testas lokalt.

| Gren | Innehåll |
|---|---|
| `feat/discord-larm` | Mejlet utbrutet ur `AdminAlertCycle` till `EmailAlertNotifier`, ny `DiscordAlertNotifier`, båda bakom `IAlertNotifier`. Larm räknas som aviserat när minst en kanal levererat. Ett larm som löser sig själv ger en "löst"-notis (bara om larmet redan aviserats). 1295 tester gröna, 11 nya i `AlertNotifierTests.cs`. |
| `feat/kallbevakning` | Dagligt workflow (06:15) som läser Trafikverkets publika sitemap (`data.trafikverket.se/hc/sitemap`, länkad från deras robots.txt) och postar nyheter som ändrats sedan förra *lyckade* körningen. Det finns ingen state-fil, så en missad körning tappar inget. ⚠️ på nyheter som rör `Situation`. Ny källa = nytt objekt i `.github/source-watch/sources.json`. |
| `ci/upptid-och-ci-larm` | `uptime.yml` var 15:e min mot backend (`/api/settings/site`, läser DB) och frontend, postar bara vid lägesändring. `ci-notify.yml` postar när Backend CI eller CI går rött på main, och när det blir grönt igen. |

## Kanaler (rekommendation)
Uppdelningen bygger på hur snabbt du behöver agera, inte på vilket system notisen kommer från.

| Kanal | Innehåll | Secret | Mobilnotiser |
|---|---|---|---|
| **#larm** | Backend-larm + upptid | `DISCORD_ALERT_WEBHOOK_URL` (**Railway**), `DISCORD_UPTIME_WEBHOOK_URL` (GitHub) | Ja |
| **#utveckling** | CI rött/grönt på main | `DISCORD_CI_WEBHOOK_URL` (GitHub) | Valfritt |
| **#källnyheter** | Källornas utvecklarnyheter | `DISCORD_SOURCE_WEBHOOK_URL` (GitHub) | Nej |

Varje funktion har en egen secret, så en funktion flyttas till en annan kanal
genom att byta URL, utan kodändring. Samma URL överallt = en enda kanal.

Kanaler att lägga till när behovet finns: **#statistik** (daglig sammanfattning,
inte byggd) och **#deploy** (Railway och Vercel kan posta själva via sina egna
inställningar).

## Fynd från Trafikverkets nyheter
- Mejlet om `TrafficFlow` (2026-11-10) **påverkar oss inte**, eftersom vi hämtar `Situation` 1.6.
- **"New groundbreaking version of Situation – API open data"** (2026-01-30)
  rör det vi använder. Den behöver läsas och stämmas av mot
  `TrafikverketApiIngestor` (schemaversion 1.6).
  https://data.trafikverket.se/news/datacache/new-groundbreaking-version-of-situation---api-open-data0

## Teknisk plats
I appen: ingen UI. Larmen syns som tidigare i Systemhälsa (Felsökning).
I koden: `backend/Application/Monitoring/IAlertNotifier.cs`,
`EmailAlertNotifier.cs`, `backend/Infrastructure/Alerts/DiscordAlertNotifier.cs`,
`.github/source-watch/`, `.github/workflows/{source-watch,uptime,ci-notify}.yml`.

## Återkommande att tänka på
- `DiscordAlertNotifier` godtar bara `https://discord.com/api/webhooks/...`,
  postar med tomt `allowed_mentions` (ett källnamn med `@everyone` pingar
  aldrig) och loggar aldrig URL:en.
- Ny larmkanal (t.ex. SMS) = ny klass bakom `IAlertNotifier` + en rad i `Program.cs`.

## Öppna frågor
- Ska SMHI, Krisinformation och Polisen in i källbevakningen? Kräver först
  en koll på om de har en sitemap eller ett nyhetsflöde för utvecklare.

## Kopplade FAQ

## Kopplade funktioner
- [[Felsokning-admin|Felsökning (Systemhälsa)]]: larmen som nu även går till Discord
- [[Kallhantering-admin|Källhantering]]
