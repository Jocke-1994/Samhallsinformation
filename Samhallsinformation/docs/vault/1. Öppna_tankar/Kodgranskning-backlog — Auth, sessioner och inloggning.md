---
typ: rå-tanke
källa: "V4-5, uppföljning av enhet-1/enhet-5/enhet-7 'under rangordningsgränsen', 2026-09-27"
---

# Kodgranskning-backlog — Auth, sessioner och inloggning

Rå tanke, inte en formaliserad idé. Del av V4-5 (`docs/code-review/FIXPLAN.md`):
en genomgång av alla "under rangordningsgränsen"/"övriga observationer" i
enhet-1…7 mot NUVARANDE kod (2026-09-27, efter 52 mergade PR:ar sedan
granskningen 2026-09-25/26). Det som redan var åtgärdat är inte med här —
se sessionsrapporten för listan. Det som återstår och har verklig substans
är samlat nedan, per fynd, med källhänvisning.

## Rate limiting

- **Auth-rate limiten (5/min/IP) ligger fortfarande på HELA `AuthController`**
  (`[EnableRateLimiting("auth")]` på klassnivå, `Program.cs`), inklusive redan
  inloggade endpoints som `/me`, `/me/export`, `/me/password` och `/refresh`.
  En normal sidladdning (refresh + me) äter av samma 5-per-minut-budget som
  inloggningsförsök — användare bakom en delad IP (mobil-CGNAT, skola,
  kontor) kan få 429 utan att ha gjort något fel. Förslag oförändrat sedan
  granskningen: separera oautentiserade endpoints (login/register/google/
  forgot/reset/verify/cancel-deletion) från redan inloggade endpoints, ge de
  senare en generösare, användar-partitionerad policy.
  *(enhet-1, autentisering/auktorisering — detta är samma exempel som redan
  nämns rakt av i FIXPLAN:s egen V4-5-rad.)*
  - Litet sidofynd: `UseRateLimiter()` ligger fortfarande efter
    `UseAuthorization()` i middleware-pipelinen — ofarligt för anonyma
    endpoints men skyddar inte auth-fel. Enkel omordning om det ändå rörs.

## Refresh-tokens och lösenordsåterställning

- **Lösenordsbyte och lösenordsåterställning återkallar numera refresh-tokens
  korrekt** (`AuthService.ChangePasswordAsync`/`ResetPasswordAsync`) — den
  delen av det ursprungliga fyndet är redan löst, troligen i V1-1.
- **Kvarstår:** `RefreshAsync` har fortfarande ingen återanvändningsdetektering
  och är inte transaktionsskyddad — två samtidiga anrop med samma refresh-
  token kan i teorin båda lyckas (race: båda läser samma rad innan någon
  hinner sätta `RevokedAt`). Flera samtidiga lösenordsåterställnings-tokens
  är också fortfarande giltiga samtidigt (`RequestPasswordResetAsync` ogiltig-
  förklarar inte tidigare utfärdade tokens). Smalt tidsfönster, men värt att
  åtgärda om sessionshantering görs om.
  *(enhet-1, autentisering/auktorisering)*

## Inmatning utan gränser

- `AuthController.UpdateMe` har fortfarande ingen längdgräns på
  `Name`/`DisplayName`. Lågt allvarlig (ingen känd exploatering), men en
  "saknad gräns" i egen rätt.
  *(enhet-1)*
- `AuthService.RegisterAsync`: `AnyAsync(Email)` följt av `Add` utan
  hantering av unikt-index-fel vid två samtidiga registreringar med samma
  e-post — ger 500 i stället för ett rent 409. Smalt race-fönster.
  *(enhet-3, övrigt)*

## Frontend: JWT-avkodning med rå `atob()`

- **`AuthContext.tsx` (`decodePayload`) och `GoogleSignInButton.tsx`
  använder fortfarande `atob(token.split('.')[1])` rakt av** — ingen
  base64url→base64-konvertering (`-`/`_`→`+`/`/`) och ingen UTF-8-avkodning.
  Konsekvens: ett fritt valt namn (inget längdkrav eller teckenfilter på
  `Name`, se ovan) som råkar innehålla `-`/`_`/`~`/`?` på fel position i
  base64-strängen får `atob` att kasta — då blir `role` "Användare",
  `exp` null (ingen refresh schemaläggs → utloggning efter ~20 min) och
  namn/e-post null. Ett namn med å/ä/ö riskerar att visas som mojibake i
  onboardingens sammanfattning (samma bugg i `GoogleSignInButton.tsx`, där
  ID-token avkodas för visning). Fix: en riktig base64url-avkodare
  (`base64url` → `TextDecoder`) på båda ställena.
  *(enhet-5, enhet-7 — samma buggmönster på två oberoende ställen)*
- En trasig/manipulerad `si_token` i `localStorage` (ogiltigt format) ger
  fortfarande `isLoggedIn = true` men ingen refresh schemaläggs — kontot
  hänger i ett "inloggat men dysfunktionellt" läge tills sidan laddas om.
  Ingen validering av token vid appstart.
  *(enhet-5)*
- `logout()` anropar `/api/auth/logout` som fortfarande omfattas av samma
  auth-ratebegränsning ovan — ett 429 på utloggning lämnar refresh-token
  giltig på servern i upp till 30 dagar trots att klienten tror sig utloggad.
  *(enhet-5)*

## Google-inloggning på fel sida

- **`/login`-sidans Google-knapp skapar fortfarande tyst ett nytt konto**
  för någon som inte har något — `LoginPage.tsx` ignorerar `isNewUser` helt
  (`onSuccess={() => navigate(redirect)}`) och `GoogleSignInButton.tsx`
  skickar alltid `acceptedTerms=true` oavsett om knappen sitter på
  `/login` eller `/register`. En ny användare som råkar klicka Google på
  fel sida hoppar över hela onboardingguiden (källval m.m.) utan att
  medvetet ha accepterat villkoren separat — villkorstexten finns under
  knappen, men inget aktivt godkännande krävs. Verifierat: `OnboardingPage.tsx`
  hanterar redan `isNewUser` korrekt när flödet går via `/register` — bara
  `/login`-vägen saknar samma hantering.
  *(enhet-7, övrigt)*

## Mindre, lägre prioritet (nämns men inte utbyggda till egna idéer)

- `GoogleTokenValidator` fångar bara `InvalidJwtException` — ett nätverksfel
  vid hämtning av Googles nycklar sprids som ett oväntat 500 trots att
  gränssnittskommentaren lovar "kastar aldrig".
- Webhook-signaturkontrollen (Resend) läser hela request-body till en
  sträng INNAN signaturen verifieras, på en anonym endpoint — ingen
  storleksgräns.
- `ResendEmailService`: `HttpResponseMessage`/`StringContent` disposas
  inte, ingen retry på 429/5xx, `HttpClient` saknar
  `PooledConnectionLifetime` (DNS cachas för processens livstid).

Ursprung för hela filen: `docs/code-review/enhet-1.md` §"Övriga
observationer", `enhet-3.md` §"Under rangordningsgränsen", `enhet-5.md` och
`enhet-7.md` §"Under rangordningsgränsen (mindre observationer...)".
