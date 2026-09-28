# Fixplan — åtgärder efter code review av hela kodbasen

Skapad 2026-09-25 på `main` efter granskning av enhet 1–8 (se [PLAN.md](PLAN.md)). Källa: `enhet-1.md` … `enhet-8.md`.
Fynd refereras som **E{enhet}#{nummer}** (t.ex. E1#5 = enhet 1, fynd 5). Alla **90 rangordnade fynd** finns i exakt en PR nedan (täckningskontroll längst ned). Mindre observationer "under rangordningsgränsen" i enhetsfilerna ligger utanför planen och samlas i V4-5.

> **Läge 2026-09-28 (genomgång gjord):** 57 av 60 utfärdade PR-nummer (#598–#657) faktiskt mergade — verifierat med `git log --merges` mot main, inte återgett ur minnet. De tre som inte mergats: **#605** (V2-1) och **#643** (V3-16) väntar på ditt beslut nedan; **#654** var en avsiktlig engångs-diagnostik (Docker-verifiering) som stängdes utan merge. Alla 57 planrader (V1-0a…V4-6) är antingen genomförda, väntar på ditt beslut (V2-1, V3-16), eller medvetet parkerade (V3-23) — se respektive rad för hur några av dem splittrades i flera faktiska PR:ar under arbetets gång. Detaljerad logg över hur granskningen och genomförandet gick till: se `git log` på den här filen och sessionens egen historik; det här dokumentet visar bara slutläget.

## Arbetsregler (gäller alla PR:ar)
- **En PR per funktion**, aldrig staplat. Kod alltid via PR; dokumentation direkt mot main.
- **Test i samma PR som fixen** (regressionstest som är rött före fixen). Testnivå enligt [enhet-8.md](enhet-8.md).
- **Breaking backend-ändring släpps tillsammans med minimal frontend-fix** (gäller V2-7).
- **Ny EF-migration med bool/Guid/DateTime-kolumn kräver raw-SQL-block i Program.cs i SAMMA PR.**
- **`/code-review low` på PR:ens diff** innan den räknas klar. Inga Co-Authored-By i commits.
- Lokal gren tas bort direkt när PR:en mergats. Ingen PR mergas utan ditt godkännande.
- Efter varje våg: uppdatera statuskolumnen här, verifiera mot produktion (GET /api/feature-flags för faktiska overrides, aldrig bara kodens default) och sammanfatta.

**Storlek:** S ≈ under 1 h arbete, M ≈ 1–3 h, L ≈ över 3 h. **Lager:** BE / FE / DB.
**Status:** ☐ ej påbörjad · ◐ pågår · ☑ mergad.

## Beslut (alla besvarade 2026-09-25)
| # | Beslut | Svar | Påverkar |
|---|---|---|---|
| D1 | Support-rollen får åtkomst till Support-inboxen (Användarlistan skrivskyddad). | **Ja** | V3-10 |
| D2 | Mitt flöde filtreras på servern i stället för klienten över 50 händelser. | **Ja** | V3-11 |
| D3 | Mock-UI: märk tydligt MOCK i admin, ta bort/dölj medborgarmock. | **Enligt rekommendation** | V3-20 |
| D4 | Token-lagring i localStorage + två externa skript (`chat.js` från kundtjänstbotens egen server, och Google Analytics `gtag` — den senare upptäcktes först i V1-0b, missades i granskningen) utan CSP. Alternativ: (A) inget nu, (B) CSP först i "rapportera-läge", (C) refresh-token i httpOnly-cookie. **Beslut: A nu, B senare (V3-22), C parkerad — se "Parkerade alternativ" nedan.** | **Beslutad** | V3-22 |
| D5 | Löst utan användarens hjälp: V1-5 *sätter* `VITE_USE_MOCK=false` i `.env.production` i stället för att ta bort filen. Fungerar oavsett vad Vercel har (Vercels miljövariabel vinner om den finns, annars gäller filen). Sessionsloggen (PR #218) bekräftar att variabeln sattes till `false` i Vercel. | **Löst** | V1-5 |
| D6 | E-postnormalisering, **rekommendation:** normalisera till gemener + skiftlägesokänsligt uppslag framåt. Migreringen kontrollerar först om normaliseringen skulle ge dubbletter; ger den det avbryts den och loggar vilka konton det gäller (ingen tyst sammanslagning). | **Enligt rekommendation** | V2-11 |

## Planeringsstatus (historik — alla punkter avklarade eller ersatta av byggd kod)
Den här sektionen styrde arbetet under uppstarten. Den lämnas kvar som historik i stället för att raderas, men allt den efterfrågade är nu antingen besvarat, byggt, eller ersatt av ett senare beslut. Facit per punkt:

- **P-A (V1-9 design):** besvarad 2026-09-25, byggd och mergad (PR #626, senare utökad i #644/CSP).
- **P-B (V2-14 GDPR-omfång):** aldrig formellt frågad — byggd på delegation när användaren bad Claude gå så långt planeringen tillät. Besluten (vad som raderas/anonymiseras/behålls) ligger dokumenterade i Obsidian `Beslut - GDPR-omfång vid kontoradering.md`, öppna för att ändras i efterhand. PR #624 mergad och verifierad.
- **P-C (V3-11 Mitt flöde-design):** samma mönster — byggd på delegation, PR #647 mergad och verifierad live i webbläsaren (2 händelser innan → flera dygns historik efteråt, källfilter + Polisen-bevakningar på servern).
- **P-D (V2-10 spoofad IP):** klar 2026-09-25, motbevisad live mot produktion. PR #623 mergad.
- **P-E (V3-16 Resend-payload):** utredd (Resends `authentication`-fält: `spf`/`dkim`/`dmarc`, kan vara `null` för äldre mejl — verifierat mot Resends dokumentation, inte mot en live-payload). PR #643 byggd med den kunskapen men **hålls** — se V3-16-raden, väntar på ditt beslut om hur `null` ska tolkas.
- **P-F (V2-9/V3-17 gränsvärden):** konkreta gränser valda och byggda, se respektive rads beskrivning. Båda mergade.
- **P-G (V3-20 mock-inventering):** gjord som en del av PR #646 — **ingen** mock-flagga var på som default i produktion när granskningen gjordes.
- **P-H (Acceptanskriterier per PR):** aldrig skriven som ett separat dokument — i praktiken löst genom att varje delegeringsprompt till en subagent innehöll en detaljerad, konkret kravlista (samma funktion, bara inte som en fristående artefakt).
- **P-I (V3-22 externa källor):** kartlagd i PR #644:s källtabell (script-/connect-/img-src för `chat.js`, Google Analytics, Google Identity, backend-API:t).

---

## Våg 1 — Akut: fel som riktiga användare träffar idag (11 PR:ar)
Mål: sluta ljuga för användare och laga det som är trasigt i live-funktioner. Snabb release.

| PR | Innehåll | Fynd | Lager | Storlek | Test | Status |
|---|---|---|---|---|---|---|
| V1-0a | **Testfundament backend:** delad SQLite-`TestDb`-hjälpare + baslinje-guard över anonyma endpoints (G4) | E8 fas 0 | BE | S | guard | ☑ mergad (PR #598 backend-testfundament) |
| V1-0b | **Testfundament frontend:** Vitest + React Testing Library + jsdom-uppsättning, ett röktest | E8 fas 2 | FE | S | rök | ☑ mergad (PR #599 frontend-testfundament) |
| V1-1 | **Lösenordsbyte på riktigt:** klient mot `PUT /api/auth/me/password`, felvisning, dölj kortet för Google-konton, serverside lösenordsregel (min 8) i `ChangePassword`, återkalla refresh-tokens vid byte. Kortet är **synligt i produktion idag** (ingen override på `konto_losenord`). | E7#1 (+ del av E1#9) | FE+BE | M | enhet+FE | ☑ mergad (PR #608) |
| V1-2 | **Webhook tål trasig indata:** `int.TryParse` + längdgräns på ticketnummer, try/catch runt JSON, idempotens på svix-id så Resend-retries inte ger dubbla ärenden | E1#5 | BE | M | enhet (webhook-svit) | ☑ mergad (PR #602) |
| V1-3 | **Ta bort `PreferencesController`** (öppen utan auth, oanvänd av frontend). Tabellen `UserPreferences` rörs inte. | E1#4 | BE | S | guard G4 | ☑ mergad (PR #601) |
| V1-4 | **Refresh loggar bara ut vid 401/403:** 429/5xx/nätverksfel ger retry med backoff; skydd mot tät refresh-loop vid klockskillnad | E5#2, E5#8 | FE | M | Vitest (AuthContext) | ☑ mergad (PR #604) |
| V1-5 | **`.env.production`:** sätt `VITE_USE_MOCK=false` (säkert oavsett Vercels miljövariabel, se D5) | E5#12 | FE | S | build | ☑ mergad (PR #600) |
| V1-6 | **"Läs mer hos källan":** länkkollen får aldrig ersätta knappen med "finns inte längre" vid timeout/403/5xx (tre lägen: levande/död/okänd) och `window.open` körs synkront i klickhändelsen | E7#2 | FE(+BE) | M | FE | ☑ mergad (PR #609) |
| V1-7 | **Bevakningsklockan:** Ångra-toasten renderas, serverfel visas, varning när sista bevakningen tas bort (vidgar Mitt flöde till hela Polisen) | E7#3 | FE | M | FE | ☑ mergad (PR #603) |
| V1-8 | **`adminFetch` med 401 → refresh + retry; bevakningar/sparade hämtas om vid fel:** Polisen-filtret får aldrig falla tillbaka på "visa allt" p.g.a. ett misslyckat anrop | E5#4, E5#5 | FE | M | Vitest | ☑ mergad (PR #619) |
| V1-9 | **Övervakning och larm (design först, sedan minimal första version):** en bakgrundstjänst utvärderar regler periodvis och larmar admins via befintlig admin-push + ett "Larm"-kort i Systemhälsa. Se [Övervakning](#övervakning-v1-9--design-och-återanvändning) nedan. | (återanvänds av E3#3, E6#8, E1#5; bevakar alt C-noten) | BE+FE+DB | L | enhet + guard | ☑ mergad (PR #626) |

Ordning: V1-0a/b först (parallellt), sedan V1-1…V1-8 i valfri ordning; V1-4 och V1-8 rör samma auth-kod → gör V1-4 före V1-8. V1-9 startar med en kort designrunda med användaren innan kod skrivs.

### Övervakning (V1-9) — design och återanvändning
**Syfte:** en enda mekanism som *märker* saker åt oss i stället för att vi ska upptäcka dem av en slump. Skapades på användarens begäran 2026-09-25 (ursprungligen för att bevaka villkoren för alt C, se Obsidian-noten "Beslut - Alt C refresh-token i cookie") och är avsiktligt generell.

**Finns redan att bygga på (verifierat i koden):** `GET /api/admin/health` (`AdminHealthController`, 75 rader, Admin-only), admin-push via `PushDispatcher` (`adminIds`-vägarna), `NotificationDeliveryLog`, `AdminActivityLog`, fyra `AddHostedService`-tjänster i `Program.cs`. **Saknas:** tröskel-/regelmekanism, larmtillstånd (öppet/kvitterat) och en larmvy.

**Föreslagen kärna:** `MonitoringService` (ny `BackgroundService`) → utvärderar regler var N:e minut → skapar/uppdaterar ett larm i en tabell (`AdminAlerts`: regel-nyckel, allvarlighet, första/senaste gång, antal, kvitterad av) → skickar admin-push vid *nytt* larm (inte varje cykel) → visas som kort i Systemhälsa med kvittera-knapp. Ny tabell med bool/DateTime → raw-SQL-block i Program.cs i samma PR.

**Regler i första versionen (varje regel = liten funktion):**
| Regel | Bevakar | Ur |
|---|---|---|
| `users_threshold` | registrerade användare ≥ 500 → "Stäm av alt C (se Obsidian-beslutet om cookie-alternativet)" (tröskeln konfigurerbar) | alt C-notens villkor 6 |
| `source_failing` | källa har misslyckats N cykler i rad eller inte hämtat på X timmar | E3#3, E3#1, E6#8 |
| `webhook_errors` | 5xx/undantag i Resend-webhooken över tröskel per timme | E1#5 |
| `push_failures` | hög andel misslyckade push-utskick | E3#4/#11 |

**Senare regler (läggs till när respektive fix finns):** CSP-överträdelser (V3-22, alt C-notens villkor 2), oväntade `Typ`-värden i Uppdateringar (E4#9), migreringsskyddets logg (V2-1), överväxt loggtabell (E2#6), ärenden utan svar > X timmar.

**Återanvändning (svar på användarens fråga):** ja — mekanismen är generell, så varje ny regel är en liten klass. Den gör också att fixarna i våg 2–3 kan *bevisas* i produktion (larmet tystnar) i stället för att vi litar på att de fungerar. **Skript-vakten** (alt C-notens villkor 1) är däremot ett CI-test, inte en driftregel, och hör hemma i V1-0b.

**Öppna designfrågor (tas i designrundan):** var N:e minut (förslag 5); vilka som larmas (alla Admin); kvitteringsflöde; om `users_threshold` ska larma en gång eller påminna veckovis; hur admins faktiskt ska nås. **Obs:** flaggan `notif_push` är `false` i produktion (verifierat via `GET /api/feature-flags` 2026-09-25) och admin-push har tidigare visat sig tystas av dold global mute eller avstängd Android-kanal. Push kan alltså inte förutsättas fungera för larm; överväg mejl via Resend (finns redan) som primär kanal och push som komplement.

---

## Våg 2 — Dataförlust och säkerhet (17 PR:ar)
Mål: stäng dataförlusts-, läckage- och missbruksytor.

| PR | Innehåll | Fynd | Lager | Storlek | Test | Status |
|---|---|---|---|---|---|---|
| V2-1 | **Migreringsstart tappar aldrig data:** `catch { alreadyMigrated=false }` får inte trigga `DROP TABLE`; droppa aldrig när `Users` finns; fånga bara "tabell saknas" | E2#2 | DB | M | enhet (start-logik utbruten) | ◐ PR #605 öppen men HÅLLS: PM-ändring (probe-fel icke-fatala) blockerades av behörighetsspärr — väntar på användaren |
| V2-2 | **Kontospärr-integritet (backend):** `DeleteMe` avvisas för admin-spärrat konto, `CancelDeletion` rör inte admin-spärr, `SetStatus(true)` hanterar schemalagd radering, spärr mot att stänga av sig själv / sista admin | E1#3, E1#7, E6#1 (BE-delen) | BE | M | enhet (spärr-svit) | ☑ mergad (PR #612) |
| V2-3 | **Massåtgärder i Användare:** "markera alla" undantar egen rad och admins, `Promise.allSettled` med per-rad-resultat i stället för "inget hände" | E6#1 (FE-delen), E6#2 | FE | M | Vitest | ☑ mergad (PR #621) |
| V2-4 | **Push-mottagarfilter:** alla fyra dispatch-vägar filtrerar bort `IsActive=false`, `DeletedAt!=null` och mottagare av opublicerade källor; avstängd personal får inte ny-användare-push | E3#5, E4#3 (push-halvan), E4#4 (push-halvan) | BE | M | enhet (~8) | ☑ mergad (PR #607) |
| V2-5 | **Dedikerade ingestorer respekterar `Source.IsActive`** (pausa i admin stoppar hämtning) | E3#6, E4#4 (ingest-halvan) | BE | S | enhet | ☑ mergad (PR #611) |
| V2-6 | **`PUT /api/user/sources` validerar källan:** endast publicerade, kända, deduplicerade id:n; okänt id ger 400, inte 500 | E4#3 | BE | S | enhet | ☑ mergad (PR #606) |
| V2-7 | **Uppdateringar: backend filtrerar synlighet + validerar `Typ`/`Synlighet`; frontend skickar token och får en `Typ`-fallback (ingen vit skärm).** Breaking → backend och minimal frontend i samma release. | E4#1, E4#9, E6#9 | BE+FE | M | enhet+FE | ☑ mergad (PR #617) |
| V2-8 | **Publika DTO:er:** `GET /api/sources` utan `LastFetchError`/interna fält; `GET /api/maintenance-banners` bara aktiva och rätt målgrupp | E4#5, E4#10 | BE | S–M | enhet | ☑ mergad (PR #613) |
| V2-9 | **Support-ticket missbruksskydd:** rate limit, längdgränser, e-postvalidering, kanal-allowlist; push till admin batchas | E1#8 | BE | M | enhet | ☑ mergad (PR #614) |
| V2-10 | **Rate limit: kontobaserad räknare + IPv6 /64.** Spoofad `X-Forwarded-For` kringgår INTE gränsen (verifierat mot produktion 2026-09-25, se P-D), så `ForwardLimit`-delen utgår. Kvar: räknare per normaliserad e-post på login (brute force mot ett konto från många IP:n) och IPv6-partition per /64 | E1#1 | BE | M | enhet | ☑ mergad (PR #623) |
| V2-11 | **Auth-härdning:** e-postnormalisering, lösenordspolicy vid registrering, Google-inloggning kräver `email_verified` och tar inte över obekräftat lokalt konto (D6 avgör migrering av befintliga) | E1#9 | BE(+DB) | M | enhet (auth-svit) | ☑ mergad (PR #622) |
| V2-12 | **Push-endpoint valideras** (https + känd push-tjänst-allowlist) mot blind SSRF | E1#6 | BE | S | enhet | ☑ mergad (PR #610) |
| V2-13 | **HTML-escape i alla mejl** (`toName`, `newEmail`, `subject`) | E3#8 | BE | S | enhet | ☑ mergad (PR #616) |
| V2-14 | **GDPR-anonymisering fullständig:** enheter, audit, ärenden och push-loggar (`NotificationDeliveryLog.Body`) rensas/anonymiseras | E3#9 | BE+DB | M–L | enhet | ☑ mergad (PR #624) |
| V2-15 | **Bekräftelse på destruktiva/globala admin-åtgärder:** ta bort källa, återställ flaggor, skicka "Ny version"-push, växla sajtinställning | E6#4, E6#5, E6#17, E6#21 | FE | M | FE | ☑ mergad (PR #618) |
| V2-16 | **Djuplänk-state rensas** så en åtgärd aldrig träffar fel användare/ärende | E6#3 | FE | S | FE | ☑ mergad (PR #615) |
| V2-17 | **Schemalagda supportsvar mejlas** (samma väg som `Reply`) + validering i `AddScheduledAction` | E3#2, E4#8 | BE | M | enhet | ☑ mergad (PR #620) |

Ordning: V2-1 och V2-2 först (dataförlust). V2-10 startar med en verifieringsfas — blir den *inte* bekräftad sjunker den till våg 4. V2-4 före V3-4 (push-dedup).

---

## Våg 3 — Robusthet (23 PR:ar)
Mål: tåla dålig extern data, dubbletter och fel utan att tyst tappa data eller fälla batchar.

| PR | Innehåll | Fynd | Lager | Storlek | Test | Status |
|---|---|---|---|---|---|---|
| V3-1 | **`EventSync` tål dubbletter** (GroupBy/first i stället för `ToDictionary`) | E3#1 | BE | S–M | enhet (SQLite) | ☑ mergad (PR #625) |
| V3-2 | **Unikt index `Events(SourceId, ExternalId)` + index på SourceId + FK**, dedupera befintliga rader före migrering. Efter V3-1. | E2#7 | DB | M | SQLite + PG-rök | ☑ mergad (PR #645) — produktionens ~6 980 händelser hade 0 dubbletter före indexet |
| V3-3 | **Ingest med isolerad `DbContext` per källa;** trasig källa skriver `LastFetchError` och fäller inte batchen | E3#3 | BE | M | enhet (SQLite) | ☑ mergad (PR #630) |
| V3-4 | **Push-dedup på riktigt** (claim före utskick, atomärt, ej fail-open) + timeout och parallellism i utskick. Ändrar testet `Claim_UnknownClaimId_FailsOpenAsClaimed` avsiktligt. | E3#4, E3#11 | BE | M | enhet | ☑ mergad (PR #627) |
| V3-5 | **Krisinformation:** ogiltigt `Published` hoppar över posten, fäller inte källan | E3#7 | BE | S | enhet + fejk-HTTP | ☑ mergad (PR #632) |
| V3-6 | **UTC vid skrivning:** normalisera `DateTime.Kind` (converter/`EnsureUtcKind`) och tidsfilter i aktivitetsloggen; `DbCommandInterceptor`-test | E2#4, E4#2 | BE | M | interceptor + PG-rök | ☑ mergad (PR #629) |
| V3-7 | **`ErrorBoundary` runt appen och per sida + catch-all-route** | E7#8 (+ stödjer E6#9) | FE | S–M | Vitest | ☑ mergad (PR #628) |
| V3-8 | **Admin: fel visas som fel** (inte tomt/0/"100 % frisk"), `onError` i mutationer, formulär stänger först vid lyckat svar, Ångra/mass-spara med felhantering | E6#8, E6#10, E6#19, E6#20 | FE | L | FE | ☑ mergad (PR #650) |
| V3-9 | **Medborgarsidans mutationer visar fel;** supportformuläret behåller text vid kategoribyte | E7#9 | FE | M | FE | ☑ mergad (PR #635) |
| V3-10 | **Support-rollens behörighet** (efter D1): backend-policy + frontend-menyer i synk. Ändrar testet `AdminSupportController_RequiresAdminRole` avsiktligt. | E4#7, E6#7 | BE+FE | M | enhet | ☑ mergad (PR #641) |
| V3-11 | **Mitt flöde filtreras på servern** (efter D2); ersätter klientfiltret över 50 händelser; gäller även Sparat | E5#1 | BE+FE | L | enhet+FE | ☑ mergad (PR #647) — verifierat live: Mitt flöde visade 2 händelser före, nu flera dygn tillbaka |
| V3-12 | **Sessioner mellan flikar/PWA:** `storage`-synk av refresh-token, react-query-cachen töms vid logout, användar-id i user-specifika query-nycklar | E5#3, E5#7 | FE | M | Vitest | ☑ mergad (PR #636) |
| V3-13 | **Push-prenumeration knuten till inloggad användare;** utloggning avregistrerar enheten; push-kortet visar riktig enhetsstatus utan att skriva över kontots inställningar | E5#9, E7#6 | FE(+BE) | M | FE+enhet | ☑ mergad (PR #642) |
| V3-14 | **Feature-flaggor:** ingen tyst `defaultAktiv`-fallback vid fel, invalidera båda mutationsvägarna | E5#10 | FE | S | Vitest | ☑ mergad (PR #631) |
| V3-15 | **Fail-fast på saknade hemligheter** (`JWT_SECRET`, `VAPID_PRIVATE_KEY`) i icke-Development; ta bort hårdkodad privat VAPID-nyckel; enda källa för JWT-hemligheten | E1#2 | BE | S | enhet | ☑ mergad (PR #637) |
| V3-16 | **Ärendesvar via mejl:** kräv SPF/DKIM-utfall från Resend-payload (verifiera först vad payload innehåller), icke-gissningsbara ticket-referenser | E1#10 | BE | M | enhet | ◐ PR #643 öppen men HÅLLS: mjukning av auth-kontroll (null accepteras + kill-switch) blockerades av behörighetsspärr — väntar på användaren, se Obsidian-beslut |
| V3-17 | **Polisen-bevakningar:** gränser för antal och längd per konto | E4#6 | BE | S | enhet | ☑ mergad (PR #633) |
| V3-18 | **`DeleteSource`:** hantera händelser och seedade källor (soft-delete/`IsActive=false`) | E4#12 | BE | S | enhet | ☑ mergad (PR #638) |
| V3-19 | **FAQ-seed skriver aldrig över adminens ändringar** och återskapar inte raderade frågor | E2#1 | BE | S | enhet | ☑ mergad (PR #640) |
| V3-20 | **Mock-hygien** (efter D3): admin-mock märks MOCK eller döljs, medborgarmock bakom flagga tas bort/döljs, notisklockan lagas så två komponenter inte skriver över varandra | E6#6, E6#11, E6#12, E6#13, E7#5 | FE | M–L | FE | ☑ mergad (PR #646) — inga mock-flaggor var på som default |
| V3-21 | **Redigera källa skriver inte över `isPublished` med gammal kopia** | E6#15 | FE | S | FE | ☑ mergad (PR #639) |
| V3-22 | **Token-lagring/CSP** (efter D4) | E5#11 | FE+BE | M–L | – | ☑ mergad (PR #644) — CSP i rapportera-läge; falsklarm från Claudes egen testrapport möjligt |
| V3-23 | **Start mot tom PostgreSQL fungerar** (schema-ordning, typläkning i rätt gren) | E2#3 | DB | M | PG-rök | ⏸ REDO ATT BÖRJA (uppdaterad 2026-09-28) — förutsättningen som saknades är nu klar: V4-6b byggde ett facit-test mot en riktig tom Postgres-container (Docker bekräftat i CI) som **bevisar buggen på riktigt** (`42P01: relation "Sources" does not exist`) i stället för att bara anta den. Testet ligger som `StartupEmptyPostgresTests.Startup_EmptyPostgres_BootstrapsAndAllDbSetsAreReadable` (+ 3 PG-rökprov i `PostgresSmokeTests.cs`), medvetet `[Fact(Skip=...)]`-markerat med rotorsaken inskriven. **Rotorsak (verifierad i kod):** `DatabaseBootstrapper.RunAsync`s "säkerställ Sources.Id-sekvens"-block körs ovillkorligt innan `MigrateAsync()` och läser `MAX("Id") FROM "Sources"` — ett antagande som bara stämmer på en databas med en tidigare SQLite→Postgres-historia, aldrig på en genuint tom databas. **Facit för fixen:** ta bort Skip på de 4 testerna, de ska gå gröna. Fortfarande medvetet inte påbörjad — produktionen är inte tom idag, så det är ingen akut risk, bara en latent en (katastrofåterställning/ny miljö) |

---

## Våg 4 — Mindre fynd (6 PR:ar)
Mål: städa sådant som inte gör skada idag. Batchas per lager; körs sist eller när kapacitet finns.

| PR | Innehåll | Fynd | Lager | Storlek | Status |
|---|---|---|---|---|---|
| V4-1 | **Backend småfynd:** ID-kollision hårdkodade/sekvens-ingestor-ID (E2#5), städning + index för loggtabeller (E2#6), admin-seed varnar vid rollkonflikt (E2#8), Trafikverket/SMHI-uppdatering av ändrade poster (E3#10), `HtmlTillText` regex-timeout (E3#12), Trafikverket `limit=100` med sortering/paginering (E3#13), ingestor-fönster i tid, inte rader (E4#11) | E2#5, E2#6, E2#8, E3#10, E3#12, E3#13, E4#11 | BE/DB | L (delas i 2 PR:ar om det växer) | ☑ mergad — V4-1a PR #648 (ID-kollisionsvakt + sekvens, retention loggtabeller, admin-seed-varning) och V4-1b PR #652 (EventSync-uppdatering av ändrade poster, regex-timeout, Trafikverket-sortering, aktivitetslogg-fönster i tid). Verifierat live: uppstart och ingest oförändrade efter `Events.UpdatedAt`-migreringen |
| V4-2 | **Session-småfynd (FE):** aktiv vy överlever refresh (E5#6), `useSourceOrder` felhantering (E5#13), timeout/abort i API-lagret (E5#14) | E5#6, E5#13, E5#14 | FE | M | ☑ mergad (PR #649) |
| V4-3 | **Admin-småfynd (FE):** schemalagd åtgärd redigeras atomärt (E6#14), CSV-export escapad och utan mockrader (E6#16), tömt datumfält (E6#18), triage-motivering och flagg-nyckel (E6#22) | E6#14, E6#16, E6#18, E6#22 | FE | M | ☑ mergad (PR #651) — E6#14 validering fixad men "avbryt+skapa nytt" kvarstår (kräver backend-PR, utanför scope) |
| V4-4 | **Medborgar-småfynd (FE):** gästens "Skapa konto"-modal + mobilmeny (E7#4), `?section=` respekterar flaggor och sökindex (E7#7), registreringens friktion (E7#10), död kod (E7#11) | E7#4, E7#7, E7#10, E7#11 | FE | M | ☑ mergad (PR #653) — `/code-review low` grönt. Kvar: `LoginPage.tsx` saknar `encodeURIComponent` på `redirect` (E7#10c, ej i scope, flaggat) |
| V4-5 | **Backlog från "under rangordningsgränsen":** skriv upp det som är värt att göra som rå tanke i Obsidian (`1. Öppna_tankar/`) eller direkt som `Ideer/`-not — inga GitHub-issues (t.ex. `auth`-rate limit på hela AuthController, refresh-tokens återkallas vid lösenordsbyte om ej gjort i V1-1, `notification-log` läcker endpoints till Support, `page`/`pageSize` klampas ej). Övrigt förkastas. | (enhetsfilernas mindre observationer) | – | S | ☑ klar — ren dokumentation, commit `b2e4016` direkt mot main (ingen PR). ~70 punkter i enhet-1…7 granskade mot NUVARANDE kod: ungefär hälften redan åtgärdade som bieffekt av de 57 mergade PR:arna (bl.a. GDPR-anonymiseringen, sista-admin-spärren, push-`IsPublished`). Resten skrivna som 4 grupperade filer i `1. Öppna_tankar/` (Auth/sessioner, Push/ingest/bakgrundstjänster, Admin-API-validering, Frontend-UX), varje punkt med källhänvisning. En handfull triviala stilanmärkningar förkastades med motivering. Viktigaste fyndet i backlogen: `PushDispatcher` grenar på `ShortName=="Polisen"`, vilket delas med "Polisen Efterlysningar" (live sedan session 49) — bekräftat i kod och produktion 2026-09-27, ger sannolikt oväntat push-beteende för bevakningar (ej akut, ingen krasch) |
| V4-6 | **Resterande testarbete** enligt enhet-8 (mål: handskriven logik från 32 % mot ~60 %; guard G1 raw-SQL↔modell, G2–G6; de 8 frontend-testerna) | E8 | BE+FE | L | ☑ klar, delad i tre PR:ar (se detaljer nedan under "Testarbete V4-6 — genomförande") |

### Testarbete V4-6 — genomförande
Delades i tre PR:ar under arbetets gång, eftersom de har olika beroenden (Docker eller inte) och olika lager:

- **Docker-verifiering (förutsättning, inte en egen plan-rad):** innan G6/PG-testerna kunde skrivas behövde vi veta om GitHub Actions-runnern faktiskt har Docker. Verifierat empiriskt 2026-09-27 med en engångs-PR (**#654**, `docker run --rm hello-world` i `ci-backend.yml`) — Docker 28.0.4 bekräftat, PR stängd utan merge (ren diagnostik, `main` orörd).
- **V4-6a — backend, SQLite/InMemory (PR #656):** byggde guard-testerna G1 (migration↔raw-SQL-block, reflekterar över alla 45 migreringar), G2 (`HasPendingModelChanges`), G3 (frontend↔backend-flaggparitet, läser `featureFlags.ts` som text), verifierade G4/G5 redan kompletta av tidigare PR:ar, och fyllde två verkliga täckningsluckor (`GenericRssIngestorTests`, `PolisenRssIngestorTests`). 157 → 1023 tester (merparten av ökningen kom redan från de 52 fix-PR:arna i våg 1–3, inte skriven av denna PR).
- **V4-6b — PostgreSQL via Testcontainers (PR #657):** den viktigaste. Extraherade uppstartens migrerings-/seedlogik till `Infrastructure/DatabaseBootstrapper.RunAsync` (en ren, verifierad mekanisk flytt ur `Program.cs` — kontrollerad rad för rad, inklusive att `databaseUrl != null || pgHost != null` ersattes med det bevisat likvärdiga `db.Database.IsNpgsql()`), så ett test kan köra EXAKT samma uppstart som produktionen mot en riktig, tom Postgres-container. **Resultat: G6 och de 3 PG-rökproven blev röda i CI** — inte ett fel i PR:en, utan första gången E2#3 (V3-23) bevisats med en riktig stack trace. Testerna ligger kvar i koden, medvetet `Skip`-markerade med rotorsaken inskriven i motiveringen (se V3-23-raden ovan för detaljer). PR:en mergades med testerna skippade; produktionen verifierad frisk efter deploy (samma händelseantal, samma svarstider).
- **V4-6c — frontend (PR #655):** jämförde enhet-8:s 8 föreslagna tester mot de ~450 som redan fanns — 7 av 8 var redan täckta (ofta mer grundligt än originalförslaget). Fyllde de två verkliga luckorna: `kallorUtils.ts` (18 tester, låser fast en tidigare dokumenterad bugg) och `lib/tid.ts` (9 tester, tidszons-/sommartidshantering — samma klass av bugg som orsakat en produktionsincident i session 36).

**Lärdom att ta med:** planens ursprungliga "L, en PR" för V4-6 underskattade hur mycket som hängde ihop med Docker-tillgänglighet. Att verifiera förutsättningen (Docker) separat och billigt INNAN man skriver de beroende testerna var rätt ordning — annars hade vi upptäckt Docker-frågan mitt i en redan skriven, ospårbar PR.

---

## Beroenden och kritisk väg
- V1-0a/b före alla PR:ar som skriver test i respektive lager.
- V1-4 före V1-8 (samma auth-kod). V2-4 före V3-4 (push). V3-1 före V3-2 (dubbletter innan unikt index). V2-7 släpps som en enhet (BE+FE).
- Alla beslut D1–D6 är fattade. V3-22 gäller bara alternativ B (CSP i rapportera-läge); alternativ C är parkerat (se nedan).

## Parkerade alternativ (ska inte glömmas)
**P1 — Alt C: refresh-token i httpOnly-cookie (ur D4/E5#11).** Parkerad av användaren 2026-09-25: "vi får inte glömma bort alt C, vet dock inte när den skulle bli aktuell."
- **Vad det är:** 30-dagars refresh-token flyttas från localStorage till en cookie som JavaScript inte kan läsa. Stark skyddsnivå, men en större ombyggnad av login/refresh/logout i både backend och frontend.
- **Trolig komplikation (overifierad):** frontend (Vercel) och API (`…up.railway.app`) ligger på olika sajter, så en cookie skulle bli tredjepartscookie och blockeras av allt fler webbläsare. Alt C kräver därför troligen att API:t flyttas till en subdomän under samma sajt som frontend (t.ex. `api.samhallsinformation.se`). Undersök det innan något beslut.
- **Ta upp C igen när något av detta inträffar:**
  1. Fler externa skript än `chat.js` och Google Analytics (`gtag`) ska läggas in på sidorna (analys, reklam, widgetar).
  2. CSP-rapporterna från V3-22 visar oväntade skriptkällor.
  3. Tjänsten ska hantera känsligare data eller betalningar/anslag (jfr monetiseringsidén).
  4. Ett säkerhetsincident-tillbud, extern penetrationstest eller granskning kräver det.
  5. API:t ändå flyttas till egen domän/subdomän (då är den svåraste delen redan gjord).
  6. Användarbasen växer markant efter kommande press/marknadsföring.
- **Uppdatering 2026-09-28:** V3-22 (B) är slutförd och mergad (PR #644). Villkor 2 ("CSP-rapporterna visar oväntade skriptkällor") bevakas nu **automatiskt** av övervakningens `csp_violation`-regel (mejlar Admin vid en ny, oväntad `script-src`-källa) — ingen manuell koll behövs längre, bara att faktiskt läsa larmen om/när de kommer. Ett känt varningstecken: PR #644:s egen testrapport nämnde en möjlig falsklarm-källa (t.ex. Google Signals som laddar från en annan Google-origin) — bekräfta första riktiga larmet innan du drar slutsatsen att alt C ska aktualiseras.
- **Påminnelse:** beslutet ligger i Obsidian: `docs/vault/Beslut/Väntar på beslut/Beslut - Alt C refresh-token i cookie.md` (syns automatiskt under "Öppna beslut" i `_Oversikt`). Kryssa villkor 2 där när ett riktigt (icke-falskt) larm faktiskt kommer in.
- Två befintliga tester låser fast buggar och ändras avsiktligt i V3-4 och V3-10.

## Uppskattning (ursprunglig) och facit (2026-09-28)
- **Ursprunglig uppskattning:** 57 planrader — våg 1 = 11, våg 2 = 17, våg 3 = 23, våg 4 = 6. (V1-9 Övervakning tillkom efter att planen skrevs, på användarens begäran 2026-09-25.)
- **Facit, verifierat med `git log --merges`:** 60 PR-nummer utfärdades (#598–#657). **57 mergade.** De 3 som inte mergades: #605 (V2-1, väntar på ditt beslut), #643 (V3-16, väntar på ditt beslut), #654 (Docker-diagnostik, avsiktligt stängd utan merge). Att antalet mergade PR:ar (57) råkar matcha antalet planrader (57) är en tillfällighet — några planrader blev flera faktiska PR:ar (V4-1 → 2, V4-6 → 3), vilket vägs upp av en oplanerad opportunistisk fix (**PR #634**, ett flakigt test i `UserAnonymizerTests` som fällde CI på en orelaterad PR — rättat samma dag, ingen egen planrad).
- Testarbetet enligt enhet-8 (ursprungligen ~135–145 tester, ~75–85 h uppskattat, overifierat) landade i praktiken på **1023 backendtester + ~500 frontendtester**, mestadels byggda som regressionstest i respektive fix-PR snarare än samlat i V4-6 — se "Testarbete V4-6 — genomförande" ovan för den delen som faktiskt låg i V4-6.
- Rekommenderad takt (följdes): en våg i taget, verifiera mot produktion efter varje våg och efter varje PR som rör uppstart/databas.

## Täckningskontroll (varje rangordnat fynd i exakt en PR)
- **E1 (10):** #1 V2-10 · #2 V3-15 · #3 V2-2 · #4 V1-3 · #5 V1-2 · #6 V2-12 · #7 V2-2 · #8 V2-9 · #9 V2-11 (+V1-1) · #10 V3-16
- **E2 (8):** #1 V3-19 · #2 V2-1 · #3 V3-23 · #4 V3-6 · #5 V4-1 · #6 V4-1 · #7 V3-2 · #8 V4-1
- **E3 (13):** #1 V3-1 · #2 V2-17 · #3 V3-3 · #4 V3-4 · #5 V2-4 · #6 V2-5 · #7 V3-5 · #8 V2-13 · #9 V2-14 · #10 V4-1 · #11 V3-4 · #12 V4-1 · #13 V4-1
- **E4 (12):** #1 V2-7 · #2 V3-6 · #3 V2-6 (+V2-4) · #4 V2-5 (+V2-4) · #5 V2-8 · #6 V3-17 · #7 V3-10 · #8 V2-17 · #9 V2-7 · #10 V2-8 · #11 V4-1 · #12 V3-18
- **E5 (14):** #1 V3-11 · #2 V1-4 · #3 V3-12 · #4 V1-8 · #5 V1-8 · #6 V4-2 · #7 V3-12 · #8 V1-4 · #9 V3-13 · #10 V3-14 · #11 V3-22 · #12 V1-5 · #13 V4-2 · #14 V4-2
- **E6 (22):** #1 V2-2/V2-3 · #2 V2-3 · #3 V2-16 · #4 V2-15 · #5 V2-15 · #6 V3-20 · #7 V3-10 · #8 V3-8 · #9 V2-7 · #10 V3-8 · #11 V3-20 · #12 V3-20 · #13 V3-20 · #14 V4-3 · #15 V3-21 · #16 V4-3 · #17 V2-15 · #18 V4-3 · #19 V3-8 · #20 V3-8 · #21 V2-15 · #22 V4-3
- **E7 (11):** #1 V1-1 · #2 V1-6 · #3 V1-7 · #4 V4-4 · #5 V3-20 · #6 V3-13 · #7 V4-4 · #8 V3-7 · #9 V3-9 · #10 V4-4 · #11 V4-4
