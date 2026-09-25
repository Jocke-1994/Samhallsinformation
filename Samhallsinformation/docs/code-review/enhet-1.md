# Code review — Enhet 1: Auth, säkerhet, publik yta

- **Granskad commit-SHA:** `2c278d3` (main, 2026-09-25)
- **Nivå:** high (recall-biased, ingen `--fix`)
- **Granskade filer** (under `Samhallsinformation/backend/`): `Controllers/AuthController.cs`, `WebhooksController.cs`, `PushController.cs`, `EventsController.cs`, `FaqController.cs`, `AdminUsersController.cs`, `AdminUserDetailsController.cs`, `SupportController.cs`, `TestingController.cs`, samt auth/CORS/rate-limit/forwarded-headers-delarna av `Program.cs`.
- **Lästa följefiler för att kunna bedöma fynden:** `Application/Auth/AuthService.cs`, `Infrastructure/Auth/JwtTokenService.cs`, `Services/GoogleTokenValidator.cs`, `WebPushNotificationService.cs`, `ResendEmailService.cs` (inbound-delen), `UserDeletionBackgroundService.cs`, `PushDispatcher.cs` (bara Recipient-raden), modellerna för tokens/User/EventShareLog, samt en genomgång av vilka controllers som saknar `[Authorize]`.
- **Metod:** genomläsning rad för rad + spårning av anropare/callees. Varje fynd verifierades mot koden (citerad rad); "PLAUSIBLE" betyder att koden tillåter felet men att det beror på driftmiljö (Railway) som inte kunnat verifieras härifrån.
- **Status för fynden:** ej fixade. Fixar = en PR per funktion (se PLAN.md).

## Sammanfattning

Inga kritiska fel i signaturverifieringen (Svix/HMAC, replay-fönster, fixed-time-jämförelse är korrekta) eller i själva JWT-hanteringen. De viktigaste fynden är: rate limiting går sannolikt att kringgå, fail-open-hemligheter, en verklig spärr-bypass via GDPR-radering, en helt oskyddad legacy-controller, och flera publika skrivande endpoints utan skydd/validering.

**Impersonation:** finns INTE i backend. `frontend/src/components/Admin/Impersonation.tsx` är en ren mock (hårdkodad testdata, inga API-anrop) och `App.tsx` visar bara en banner om URL-parametern `?impersonating` finns. Ingen token utfärdas åt annan användare, så ingen backend-attackyta att granska. Om funktionen byggs på riktigt behöver den en egen review (tidsbegränsad token, `act`-claim, audit-logg, blockera DeleteMe/ChangePassword/email-change under impersonation).

## Fynd (rangordnade, mest allvarligt först)

### 1. Rate limiting per IP går troligen att kringgå via `X-Forwarded-For` (och IPv6) — PLAUSIBLE, hög
- `Program.cs:200-207` (ForwardedHeaders), `Program.cs:86-113` (policies)
- `ForwardLimit = null` + rensade `KnownProxies`/`KnownIPNetworks` gör att middleware:t litar på HELA X-Forwarded-For-kedjan och sätter `RemoteIpAddress` till den VÄNSTRASTE posten. Kommentaren i koden beskriver själv kedjan som `"<riktig klient-IP>, <Railways proxy-IP>"`, dvs Railway *lägger till* poster; en klient som skickar egen `X-Forwarded-For: <slumpad IP>` får den som partitionsnyckel. Argumentet "containern nås bara via Railway" motbevisar inte att en klientskickad header bevaras längre vänster i kedjan.
- Scenario: angripare skickar 1 000 inloggningsförsök mot `/api/auth/login` med ny slumpad `X-Forwarded-For` per anrop -> aldrig 429. Samma sak gäller `eventssearch`. Även utan spoofing: partitionen är ett enskilt IPv6-/128, så en angripare med ett /64 har 2^64 partitioner.
- Ingen kontobaserad låsning finns heller (varken per e-post eller per konto), så IP-räknaren är det enda skyddet mot brute force/credential stuffing.
- Föreslagen fix: verifiera live (`curl -H "X-Forwarded-For: 1.2.3.4"` mot en diagnostik-echo, som förra gången) om Railway skriver över eller lägger till; sätt `ForwardLimit` till det verkliga antalet betrodda hopp (2) så bara de högraste posterna används; normalisera IPv6 till /64 i partitionsnyckeln; lägg till räknare per normaliserad e-post på login.

### 2. Fail-open dev-hemligheter i produktionskoden — PLAUSIBLE (beror på Railway-env), hög om env saknas
- `Program.cs:63-65` och `Infrastructure/Auth/JwtTokenService.cs:17-19`: `JWT_SECRET ?? "dev-secret-change-in-production-at-least-32-chars"`. Om variabeln saknas/felstavas i en miljö startar appen utan fel och alla JWT signeras med en publik sträng -> vem som helst kan smida en admin-token (`role=Admin`).
- `Program.cs:123-124`: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` har hårdkodade fallbackar, inklusive PRIVAT nyckel, incheckad i git. Om de används i prod kan alla som läser repot skicka push som ser ut att komma från tjänsten till alla prenumeranter.
- Extra: hemligheten dupliceras på två ställen (Program.cs + JwtTokenService) och kan glida isär.
- Föreslagen fix: i icke-Development kasta vid start om `JWT_SECRET`/`VAPID_PRIVATE_KEY` saknas; ta bort privata nyckeln ur källkoden och rotera den (den ligger i git-historiken); läs hemligheten från en enda källa (t.ex. `IOptions`). Verifiera nu att Railway har riktiga värden.

### 3. Spärr-bypass: en avstängd användare kan häva sin egen avstängning via GDPR-radering — CONFIRMED, medel-hög
- `AuthController.cs:302-330` (`DeleteMe`), `Application/Auth/AuthService.cs:356-373` (`CancelDeletionAsync`), `AdminUsersController.cs:140-158`
- JWT:er valideras utan att `IsActive` kontrolleras, så en avstängd användares access-token gäller upp till 15 minuter. `DeleteMe` kräver bara `[Authorize]`, kontrollerar inte `IsActive`, och skickar en `cancel-deletion`-länk till användarens egen mejl. `CancelDeletionAsync` sätter sedan `IsActive = true`, `SuspendedAt = null`, `SuspendedReason = null` — det raderar den ursprungliga avstängningen.
- Scenario: admin stänger av användare U för missbruk -> U (med giltig token) anropar `DELETE /api/auth/me` -> klickar länken i mejlet -> kontot är aktivt och avstängningen borta. Samma sak om admin senare raderar ett tidigare avstängt konto och användaren klickar mejllänken.
- Föreslagen fix: `DeleteMe` avvisar `!IsActive`; spara avstängningen separat och återställ den (inte nolla) vid avbruten radering; överväg `IsActive`-koll i `OnTokenValidated`/ett auktoriseringskrav så en spärr slår igenom direkt (även på ändrad roll, som annars dröjer 15 min).

### 4. `PreferencesController` saknar all autentisering och all ägarkontroll — CONFIRMED, medel (fil utanför listan, hittad i "publika endpoints utan auth"-genomgången)
- `Controllers/PreferencesController.cs:9-70` (0 `[Authorize]`, 4 endpoints)
- `GET /api/preferences/{userId}` läser vem som helst, `POST` skapar, `PUT/DELETE /{id}` ändrar/raderar valfri rad utan att kolla ägare. Hela `UserPreference`-modellen binds från body (mass assignment). Bara Guid-ID:n skyddar PUT/DELETE, men `userId` är en fri sträng.
- Föreslagen fix: bekräfta om frontend använder den (legacy?) — ta annars bort controllern; annars `[Authorize]` + scopa mot `User`-claimet + DTO istället för entiteten. Hör hemma i enhet 4 men är allvarlig nog att rapportera här.

### 5. Webhook: `int.Parse` på angriparstyrd adress ger 500 -> Resend retry-storm — CONFIRMED, medel
- `WebhooksController.cs:104` (`int.Parse(...Groups[1].Value)`, regex `\d+` utan längdgräns), anrop från rad 89.
- Signaturen skyddar mot förfalskade webhooks, men INNEHÅLLET i `to` styrs av avsändaren av mejlet. Vem som helst kan mejla `svar+99999999999999999999@samhallsinformation.se` -> Resend levererar en korrekt signerad webhook -> `OverflowException` -> 500. Resend/Svix försöker igen på icke-2xx och kan till slut inaktivera endpointen, vilket stänger hela inbound-supportkanalen. Samma väg: `JsonDocument.Parse`/`GetProperty("data")`/`EnumerateArray` (rad 66, 73, 78) kastar vid oväntad form i stället för att svara 200/400.
- Relaterat (samma controller): ingen idempotens. `svix-id` sparas aldrig och `email_id` dedupliceras inte, så en Resend-retry (t.ex. efter timeout) eller ett replayat anrop inom 5-minutersfönstret ger dubbla ärenden/meddelanden (rad 89-96, 193). Ticket-numret tilldelas via `MaxAsync + 1` (rad 193, likadant i `SupportController.cs:53`) utan retry -> samtidiga anrop krockar mot unikt index och ger 500.
- Föreslagen fix: `int.TryParse` (vid ogiltigt nummer: 200 + logg); `try/catch` runt JSON-hantering som svarar 200 vid oväntad struktur; spara `svix-id`/`email_id` med unikt index och hoppa över dubbletter; ta ticket-nummer från databassekvens eller retry vid unikt-index-fel.

### 6. Push-prenumeration accepterar godtycklig endpoint-URL -> blind SSRF från servern — CONFIRMED (avsaknad av validering), medel
- `PushController.cs:158-181` (`Subscribe`), utskick i `Services/WebPushNotificationService.cs:27-36`
- `req.Endpoint` sparas oförändrad och servern POST:ar senare till den URL:en (`WebPushClient.SendNotificationAsync`). Registrering är öppen och e-post behöver inte vara verifierad, så vilken registrerad användare som helst kan peka en "enhet" mot `http://intern-tjänst/...`, `http://169.254.169.254/...` eller en avsiktligt långsam server som fördröjer utskicksloopen. Ingen kontroll av https/allowlist över kända push-tjänster (fcm.googleapis.com, updates.push.services.mozilla.com, *.push.apple.com, *.notify.windows.com).
- Föreslagen fix: kräv `https` och host mot en allowlist av kända push-leverantörer, samt max längd för Endpoint/Keys/DeviceName.

### 7. Admin "återaktivera" avbryter inte schemalagd radering -> aktivt konto anonymiseras senare — CONFIRMED, medel
- `AdminUsersController.cs:77-96` (`SetStatus`), `Services/UserDeletionBackgroundService.cs:47-63`
- `SetStatus(IsActive=true)` rör aldrig `DeletionScheduledAt`/`DeletionCancelToken`. Kontot ser aktivt ut i admin och användaren kan logga in, men inom 24 h kör bakgrundstjänsten anonymiseringen (namn, e-post, lösenord skrivs över, `Role = "Användare"`, `IsActive = false`) — oåterkallelig dataförlust. Motsvarande: `SetStatus` kan också "återuppliva" ett redan anonymiserat konto (`DeletedAt != null`).
- Också: ingen skyddsspärr mot att admin stänger av sig själv eller sista admin (jämför `Delete` som har `id == CurrentUserId`-kontroll).
- Föreslagen fix: avvisa `SetStatus` för konton med `DeletionScheduledAt != null || DeletedAt != null` (hänvisa till `cancel-deletion`), och avvisa spärr av sig själv.

### 8. Anonym `POST /api/support/tickets` utan rate limit och utan längdgränser — CONFIRMED, medel
- `SupportController.cs:37-100` (`[AllowAnonymous]`)
- Ingen rate limit, ingen max längd på `Message/Subject/Category/Channel/ContactName/ContactEmail` (bara Kestrels 30 MB bodygräns), ingen e-postvalidering, och `Channel` tas rakt från klienten. Varje anrop skapar ett ärende + en push till alla admins (`DispatchNewTicketAsync`) och en loggrad. Angripare kan översvämma supportinkorgen, admin-telefonerna och databasen. `ContactEmail` kan sättas till ett offrets adress, så en admins svar (`SendTicketReplyAsync`) skickas till en tredje part. `Reply` (rad 160-190) validerar inte ens tom text (Create gör det).
- Föreslagen fix: en egen rate-limit-policy (t.ex. 5/timme/IP), längdgränser, e-postformat-koll, allowlist för `Channel`; samma gäller info@-flödet i webhooken (`WebhooksController.cs:172-232`, godtycklig avsändare skapar ärende + push).

### 9. Registrering/inloggning: ingen e-postnormalisering, svag/saknad lösenordsvalidering, pre-hijack via Google — CONFIRMED (kod), medel-låg
- `Application/Auth/AuthService.cs:35-61` (Register), `:70-89` (Login), `:91-131` (Google), `AuthController.cs:154-167` (ChangePassword)
- E-post jämförs skiftlägeskänsligt (`u.Email == email`, unikt index skiftlägeskänsligt i Postgres) och normaliseras/valideras aldrig i `Register` (ingen `@`-koll, ingen längdgräns; bara i e-postbytet). `Kalle@x.se` och `kalle@x.se` blir två konton; Google-inloggning (Googles e-post) hittar inte ett konto skapat med versaler och skapar ett andra konto. `RegisterAsync` kräver bara att lösenordet inte är tomt (ett tecken går bra) medan `ResetPasswordAsync` kräver 8 — `ChangePassword` i AuthController kräver ingenting.
- Pre-hijack: en angripare registrerar ett lösenordskonto med offrets Gmail-adress (ingen verifiering krävs för att få tokens, och `AuthProvider` blir "local"). När offret senare loggar in med Google hittas det befintliga kontot och offret loggas in i angriparens konto (angriparen kan lösenordet och är redan inloggad). `GoogleLoginAsync` kontrollerar heller inte `email_verified` i Googles payload (`Services/GoogleTokenValidator.cs:23-26`).
- Föreslagen fix: `Trim().ToLowerInvariant()` (eller `citext`) + `MailAddress`-validering vid register/login/google/reset; gemensam lösenordspolicy; i `GoogleLoginAsync` — om det befintliga kontot är `local` och `!EmailVerified`, avvisa/kräv verifiering; kontrollera `EmailVerified` i Google-payloaden.

### 10. Ärendesvar via mejl: avsändaradressen är inte autentiserad — PLAUSIBLE, medel-låg
- `WebhooksController.cs:102-127`
- "Spoofing-skydd" jämför bara `From`-headern mot ärendets `ContactEmail`. `From` kan förfalskas fritt om inte inbound-mejlets SPF/DKIM/DMARC-utfall kontrolleras (webhooken läser inget sådant fält). Ärendenummer är löpande heltal och kontaktadressen är känd för den som skapade ärendet. Scenario: angripare mejlar `svar+12@` med `From: kund@example.com` -> ett meddelande "från kunden" läggs i tråden, uppdaterar `LastUserMessageAt` och skickar push.
- Föreslagen fix: kräv att Resends inbound-payload/`GET /emails/receiving/{id}` rapporterar godkänd SPF/DKIM för From-domänen (verifiera vilka fält Resend exponerar), eller ett oförutsägbart token i svar-adressen (`svar+{ticket}.{slumpad}@`) istället för enbart löpnummer.

## Övriga observationer (under rangordningsgränsen, sparade så de inte förloras)

**Autentisering/auktorisering**
- `Program.cs:87-93`: policyn `auth` ligger på HELA `AuthController` (`AuthController.cs:17`), inklusive inloggade `/me`, `/me/export`, `/me/password` och `/refresh`. 5 anrop/min/IP räcker knappt för en normal sidladdning (`refresh` + `me`) — användare bakom delad IP (mobil-CGNAT, skola, kontor) får 429. Lägg bara policyn på oautentiserade endpoints (login/register/google/forgot/reset/verify/cancel-deletion) och ge de övriga en generösare, användar-partitionerad policy.
- Lösenordsbyte (`AuthController.cs:154`) och lösenordsåterställning (`AuthService.cs:200`) återkallar inte refresh-token (jämför e-postbyte som gör det, `AuthService.cs:326-331`) — efter en kapning lever den stulna sessionen i upp till 30 dagar. Flera samtidiga återställningstokens är också giltiga, och `RefreshAsync` är inte transaktionell/har ingen återanvändningsdetektering (två samtidiga refresh med samma token lyckas båda).
- JWT valideras med `ValidateIssuer/Audience = false` (ok med en enda utfärdare) men `IsActive`/roll läses aldrig om: avstängd användare eller nedgraderad admin behåller åtkomst i upp till 15 min (se fynd 3).
- `AuthController.cs:302` `DeleteMe`: en admin kan radera sitt eget (sista) adminkonto; `_ = _email.Send...` (fire-and-forget) ger ingen felhantering/logg när mejlet med ångra-länken inte går iväg — då är kontot spärrat utan möjlighet att ångra. Samma mönster i `AuthService` för verifiering/återställning.
- `UpdateMe` (`AuthController.cs:96-150`) har inga längdgränser på `Name/DisplayName`.

**Publika endpoints**
- `EventsController.GetLinkStatus` (`:186`) är anonym utan rate limit och gör en utgående GET per anrop (8 s timeout, följer redirects) mot `evt.Url` — kan användas för att generera trafik mot myndighetskällorna och binda serverresurser; URL:en kommer från ingestade flöden, så SSRF-risken är låg men reell om ett flöde innehåller interna/omdirigerande länkar.
- `EventsController.LogShare` (`:213`) är anonym utan rate limit och validerar inte att händelsen finns -> obegränsad tillväxt av `EventShareLogs` med påhittade Guid:s och förgiftad statistik (ingen FK, `Models/EventShareLog.cs`).
- `EventsController.cs:35-36,83,122-123,164`: `pageSize` klampas bara uppåt (`> 100`) — `pageSize <= 0` och `page` nära `int.MaxValue` (overflow i `(page-1)*pageSize`) ger negativt `Skip/Take` -> 500 i Npgsql. Gäller både `GetEvents` och `SearchPublic` (och `AdminEventSearchController`).
- `SearchPublic` (`:151-153`): `%`/`_` i `sokord`/`geography` escapas inte i `Like` (wildcard-injektion) och LIKE `%x%` på `Content` är en full tabellskanning, bara skyddad av rate limit som kan kringgås (fynd 1).
- `EventsController.GetEvent` (`:91`) och `GetLinkStatus` returnerar händelser även från opublicerade (test-)källor om man har ID:t, till skillnad från `GetEvents`/`SearchPublic` som filtrerar på `IsPublished`.
- `PushController.Claim` (`:133`, anonym) — designat fail-open och ID:t är en slumpad Guid, men det finns ingen rate limit. Ingen åtgärd rekommenderad utöver rate limit.
- `FaqController`: admin-endpoints korrekt `[Authorize(Roles = "Admin")]`. Ingen validering av `FlagKey` mot kända flaggor eller längd på `Fraga/Svar`. Publika `GET /api/faq` returnerar hela entiteten (inkl. `FlagKey`, tidsstämplar) — ofarligt.

**Admin/Support**
- `AdminUserDetailsController.cs:187-210` (`GetNotificationLog`, Admin+Support) returnerar `Recipient`, som för push är hela enhetens `Endpoint` (`PushDispatcher.cs:246`) — motsäger kommentaren i samma fil (`:243`, "Endpoint/P256dh/Auth exponeras avsiktligt inte") och är känsliga prenumerations-URL:er. Returnera en trunkerad förhandsvisning som `PushController.ListLogs`.
- `AdminUserDetailsController`: `SaveEvent`/`UnsaveEvent` (`:308`), `SetUserSourceActive` (`:139`) och `CreatePolisenBevakning` kontrollerar aldrig att `{id}`/`eventId`/`sourceId` finns (och att källan är publicerad) -> FK-fel (500) eller prenumeration på opublicerad källa; `SaveEvent`/`UnsaveEvent` saknar audit-logg medan övriga skrivningar loggar. Supportrollen (inte bara Admin) kan ändra vilken användares (även en admins) push-inställningar.
- `AdminUsersController.Delete` (`:107`) hindrar bara självradering — en admin kan radera en annan admin. `Lookup`/`GetUsers` är ok (Admin-only).
- `Services/UserDeletionBackgroundService.cs:47-63` (utanför enhet 1): anonymiseringen rensar inte `RefreshTokens`, `UserDevices`, `EmailChangeToken.NewEmail`, `UserSettingAuditLog.OldValue/NewValue` (innehåller gamla e-postadresser/namn) eller `SupportTicket.ContactEmail/ContactName`/ärendetexter — GDPR-radering är ofullständig. Lägg till i enhet 3.

**Webhook (övrigt)**
- `WebhooksController.cs:308-312` (`KlippBortCiterat`): `rad.StartsWith("Den ") && rad.Contains("skrev")` och `StartsWith("Från:")` kan träffa vanlig text på första raden ("Den här lösningen skrev jag om...") -> hela svaret tolkas som citat och kastas tyst (bara varningslogg, HTTP 200 så Resend inte försöker igen) = förlorat kundsvar.
- `WebhooksController.cs:80-90`: `TicketAdressMönster` körs mot råa `to`-strängen (`^svar\+...`) medan info@-grenen använder `ParseraEpostadress`; en adress med visningsnamn (`"Svar" <svar+12@...>`) matchar inte första grenen.
- Obegränsad läsning av request-body in i en sträng före signaturkontrollen (rad 59-62) på en anonym endpoint.
- Signaturverifieringen i sig är korrekt: HMAC-SHA256 över `{id}.{ts}.{body}`, base64-nyckel, `FixedTimeEquals`, ±5 min-fönster, fail-closed utan secret.

**Testing**
- `TestingController.DryRun` (`:51`, Admin-only): hämtar godtycklig URL från servern (SSRF mot intern infrastruktur/metadata) och returnerar `ex.Message` till klienten. Rimligt för en admin men bör blockera privata IP-intervall och ha timeout. `[Authorize(Roles = "Admin")]` på klassen är korrekt; alla routes ligger under `/api/admin/testing/`.

**Övrigt i Program.cs**
- CORS (`Program.cs:56-60`): explicit origin-lista från `ALLOWED_ORIGINS`, ingen credentials, ok. Default är bara `http://localhost:5173`, så en miss i env ger blockerad frontend, inte öppen CORS.
- `UseRateLimiter` ligger efter `UseAuthorization` (`:209-212`) — ok för anonyma endpoints men bör flyttas före för att också skydda auth-fel.
- Admin-seed (`Program.cs:1492-1512`) läser lösenord ur env och hashar det; ok. Seedad admin får `EmailVerified = false`.

## Rekommenderad fix-ordning (en PR per funktion)
1. Rate limiting/forwarded headers (fynd 1 + policy-omfång) — verifiera live först.
2. Start-fail-fast för hemligheter + rotera VAPID (fynd 2).
3. Suspension/radering-flödet (fynd 3 + 7) — hör ihop logiskt men är två PR:ar (auth vs admin).
4. `PreferencesController` (fynd 4).
5. Webhook-härdning (fynd 5 + 10 + trunkeringsheuristiken).
6. Push-endpoint-allowlist (fynd 6).
7. Support-anrop: rate limit/validering (fynd 8).
8. E-post-normalisering, lösenordspolicy, Google-pre-hijack (fynd 9).
