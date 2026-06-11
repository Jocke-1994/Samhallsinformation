# Projektöversikt – Samhällsinformation & Notifieringar

Detta projekt är ett fristående verktyg utvecklat i .NET som samlar samhällsinformation från svenska myndigheter på en gemensam plats. Syftet är att göra offentlig information mer tillgänglig via webb och kontrollerade notifieringar utan att tolka eller ändra källmaterialet.

## Grundprinciper (Låsta beslut)

Dessa principer utgör systemets kärna och bryts aldrig:

* **Ingen opinionsbildning:** Systemet skapar inget eget innehåll.
* **Ingen tolkning:** Information omformuleras aldrig; systemet fungerar som ett förmedlande lager.
* **Källkrav:** Ingen information visas utan en verifierad primär källa.
* **Transparens:** Systemet är tydligt med varför en notifiering skickas eller uteblir.

## Teknisk Arkitektur

Projektet är byggt med en modern .NET-stack och följer en iterativ sprint-filosofi:

* **Backend:** ASP.NET Core Web API med bakgrundstjänst för datainsamling.
* **Datamodell:** En gemensam intern struktur (`CanonicalEvent`) för att standardisera metadata från olika källor.
* **Databas:** SQLite lokalt (planerad migrering till PostgreSQL vid publicering) via Entity Framework Core.
* **UI/UX:** Modern, "clean" design med stöd för mörkt/ljust tema.

## Informationsomfång & Metadata

Systemet hanterar information baserat på tillgänglig metadata:

* **Obligatorisk metadata:** Källa, publiceringsdatum, titel, innehåll och länk.
* **Valfri metadata:** Geografisk klassning, allvarlighetsgrad och kategori.
* **Fallback:** Om allvarlighetsgrad saknas används "Bra att veta". Om geografi saknas betraktas informationen som nationell.

## Projektstatus & Sprintar

### Sprint 1: Reality Check (Avslutad)

- [x] Definiera gemensam intern modell (`CanonicalEvent`).
- [x] Skapa grundläggande mappstruktur och C#-klasser.
- [x] Verifiera att testdata kan mappas korrekt till modellen.

### Sprint 2: Ingestor (Avslutad)

- [x] Fetch events from Polisen RSS (#4)
- [x] Parse RSS feed into CanonicalEvent (#5)
- [x] Handle missing metadata with fallbacks (#6)
- [x] Support multiple source types (#7)

### Sprint 3: Storage & API (Avslutad)

- [x] Persist events to database (#9)
- [x] Expose events via REST API (#10)
- [x] Deduplicate incoming events (#11)
- [x] Store and manage user notification preferences (#12)

### Sprint 4: Notifications & UI (Backlog)

- [ ] Send notifications based on user preferences (#13)
- [ ] Explain why a notification was sent (#14)
- [ ] View events on a clean web UI (#15)
- [ ] User filters events by geography (#16)

## Session Log

### Session 6 — 2026-06-11 (Current)
**What was done:**
- Mobilvy: Sidebar konverterad till slide-in drawer på mobil med hamburger-knapp i NewsFeed-headern (PR #196)
- Edge swipe: `react-swipeable` installerat, swipa höger från ≤30px vänsterkant öppnar sidebar, swipa vänster stänger (PR #196)
- Dark mode: `ThemeContext` läser nu `prefers-color-scheme` som fallback för alla användare; lyssnar på OS-ändringar dynamiskt; sparar bara manuellt val till localStorage (PR #196)
- Responsiv padding i header, filter och händelselista (`px-4 md:px-10`) (PR #196)
- Fixat Vercel-byggfel: `ProfilePage.tsx` saknades `isOpen`/`onClose` props till Sidebar (PR #196)
- GitHub CI-pipeline: `ci.yml` bygger och type-checkar frontend på varje PR mot main (PR #197)
- Dependabot: `dependabot.yml` skapar automatiska PR:ar för npm och NuGet varje vecka (PR #197)
- `npm audit --omit=dev --audit-level=high` i CI — ignorerar dev-beroenden som aldrig når produktion (PR #207)
- Mergat 15 Dependabot-säkerhets-PR:ar, inklusive react-router 7.13.1→7.17.0 som fixade majoriteten av sårbarheterna
- CodeQL ej tillgängligt på privat personligt repo (kräver GitHub Advanced Security för organisationer)
- Secret scanning ej tillgängligt av samma anledning; Dependabot alerts aktiverat och täcker det viktigaste
- Skapat `docs/kallor/OVERSIKT.md` med alla 8 källor, API-info, rate limits och licenser (PR #209)
- Skapat `docs/kallor/CHANGELOG.md` för att logga källändringar över tid (PR #210)
- Lagt till långsiktig vision i OVERSIKT.md: roadmap V1–V5 mot ~340 svenska källor, PSI-direktivet, datapartnerskap med myndigheter
- Lagt till långsiktig vision i PROJEKT.md: kommuner som manuella användare via ticket-funktion, "Ansök om att bli källa" får konkret syfte som B2G-onboarding-flöde

- Ändrat "Bra att veta"-filterflik och händelsepill från grå till sky-blå för tydligare visuell distinktion (PR #213)
- Lagt till `CookieConsent`-banner med accordion som visar vilken data som samlas in (nödvändiga vs analys); sparar val i localStorage (PR #213)
- Lagt till `FeedbackModal` via Formspree (ID: `xpqeyzjj`) kopplad till lila pill-knapp längst ner i sidebaren (PR #213)
- Lagt till `Npgsql.EntityFrameworkCore.PostgreSQL 10.0.*` i backend (PR #215)
- Uppdaterat `Program.cs`: PostgreSQL via `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` när `PGHOST` finns, annars SQLite; CORS via `ALLOWED_ORIGINS` env-var; `MigrateAsync()` vid start (PR #215, #216, #217)
- Skapat `Dockerfile` i `backend/` — Railway kan inte auto-detekta .NET 10 med Nixpacks (PR #215)
- Railway: skapat projekt `Samhallsinformation`, lagt till PostgreSQL-plugin, Root Directory satt till `Samhallsinformation/backend`
- Vercel: lagt till `VITE_API_URL=https://samhallsinformation-production.up.railway.app` och `VITE_USE_MOCK=false`; tvingad cache-fri redeploy för att baka in Vite env-vars (PR #218)
- Köpt domän `samhallsinformation.se` från Loopia (9 SEK/år)
- Lagt till `samhallsinformation.se` i Vercel Domains; A-record `216.198.79.1` och CNAME `www → 3eefa53b97d41c65.vercel-dns-017c0m.`
- Påbörjat Cloudflare-setup för gratis DNS (Loopia kräver betaluppgradering för DNS-redigering)

**Problem och lösningar denna session:**
- `Npgsql 9.0.*` kräver EF Core 9.x → uppgraderat till `10.0.*`
- Railway byggde från repo-roten och hittade inte Dockerfile → Root Directory satt till `Samhallsinformation/backend`
- `DATABASE_URL` kom som URI (`postgresql://...`) men Npgsql kräver key=value → bytt till separata `PGHOST`/`PGPORT` etc.
- `VITE_API_URL` saknades `https://`-prefix → URL byggdes som `vercel.app/railway-host/api/...` → fixat i Vercel env-vars
- Vercel cachade gamla builden utan `VITE_API_URL` → tvingad cache-fri redeploy löste det
- Loopia DNS kräver betaluppgradering → Cloudflare som gratis DNS-lösning

**Next session:**
- Slutföra Cloudflare DNS-setup: A-record `samhallsinformation.se → 216.198.79.1`, CNAME `www → 3eefa53b97d41c65.vercel-dns-017c0m.`
- Byta Loopias nameservers till Cloudflares
- Lägga till `https://samhallsinformation.se,https://www.samhallsinformation.se` i Railway `ALLOWED_ORIGINS`
- Google Analytics (GA4) — sätt upp med europeisk dataregion
- Sätta upp e-post `info@samhallsinformation.se` via Zoho Mail (gratis)
- Granska historisk data i Railway PostgreSQL — verifiera att all Polisen/Krisinformation-data finns

---

### Session 5 — 2026-06-10
**What was done:**
- Frikopplat alla UI-funktioner från versionsstyrning (`versionAtLeast` borttagen från `App.tsx` och `Sidebar.tsx`)
- Etablerat tydlig rolldelning: versioner = rollback/deployment-spårning, feature flags = explicit aktivering av funktioner
- Skapat `src/lib/version.ts` (versionssystem) på egen branch
- Skapat `src/lib/featureFlags.ts`, `useFeatureFlags`-hook och `FeatureFlagsAdmin`-komponent på egen branch
- Kopplat in Feature flags-sektionen i admin-panelen (AdminSidebar + AdminPage)
- Löst merge-konflikt i `AdminPage.tsx` mellan rollvaljare- och feature-flags-brancherna
- Mergat PR #186 (version-gates), PR #187 (feature-flags), PR #188 (rollvaljare) till main
- Dolt inställningar och profilknapp i sidebaren för utloggade användare — visas bara när `isLoggedIn` är true (PR #189)
- Centrerat app-namnet "Samhällsinfo" i sidebaren (PR #190)
- Begränsat mockdata till V1-källor: Polisen + Krisinformation aktiva, övriga 6 inaktiva (PR #191)
- Lagt till `KrisinformationApiIngestor` mot `api.krisinformation.se/v3/news` (PR #192)
- Uppdaterat `IngestorBackgroundService` och `Program.cs` för stöd av flera ingestors
- Rensat 8 stale lokala branches (remote borttagna)
- Kombinerat flöde: "Samhällsinfo" klickbar → alla källor samlade sorterade på tid (PR #194)
- Färgad vänsterkant per källa (blå=Polisen, orange=Krisinformation), källnamn i grå text höger
- Datumseparatorer i prickad stil med "Idag 10 juni" / "Igår" / datum
- Filterbadges med pill-siffra, tomt-state vid tomma filterval
- Klockslag istället för datum på varje rad, geografi-duplikat borttaget
- "lästa"-separator gömd för utloggade + max en per lista
- "Samhällsinformation" som rubrik i stora ytan, separator under app-namn i sidebar
- Mockdatum uppdaterade till juni 2026

**Next session:**
- Google Analytics
- Hosting: Neon PostgreSQL + Railway (BE)
- Koppla frontend mot live-backend (VITE_USE_MOCK=false)

---

### Session 4 — 2026-02-16
**What was done:**
- Sprint 3 completed: Storage & API
- Converted project from Console app to ASP.NET Core Web API
- Added Entity Framework Core with SQLite provider
- Created `AppDbContext` with `Events`, `Sources`, and `UserPreferences` tables
- Indexed `ExternalId`, `Geography`, `PublishedAt` for performance
- Created `IngestorBackgroundService` — runs every 5 min, fetches events, deduplicates by `ExternalId` (#9, #11)
- Created `EventsController` — `GET /api/events` with filtering (geography, source, date, national, pagination) and `GET /api/events/{id}` (#10)
- Created `SourcesController` — `GET /api/sources`
- Created `PreferencesController` — full CRUD for user notification preferences (#12)
- Created `UserPreference` model with geography/source/severity filters
- Added `IngestedAt` timestamp to `CanonicalEvent`
- Added `.gitignore` for SQLite database files
- Verified: 200 live Polisen events fetched, deduplicated, and queryable via API

**Next session:**
- Start Sprint 4: Notifications & UI
- Send notifications based on user preferences (#13)
- View events on a clean web UI (#15)

---

### Session 3 — 2026-02-12
**What was done:**
- Sprint 2 completed: RSS ingestor for Polisen
- Created `IIngestor` interface for pluggable source types (#7)
- Implemented `PolisenRssIngestor` — fetches and parses live RSS into `CanonicalEvent` (#4, #5)
- Created `MetadataFallbacks` helper with geography/severity fallback logic (#6)
- Added `System.ServiceModel.Syndication` NuGet package for RSS parsing
- Updated `Program.cs` to fetch and display 200 live police events
- Geography extracted from title (last comma-segment), severity defaults to "Bra att veta"
- Merged PRs #17 (Sprint 2) and #18 (CLAUDE.md)

---

### Session 2 — 2026-02-12
**What was done:**
- Created CLAUDE.md with full project overview
- Set up GitHub Project Board ("Samhällsinformation Roadmap") linked to the repo
- Created 12 custom labels (user-story, use-case, feature, bug, infrastructure, sprint-1–4, priority levels)
- Created 14 issues across 4 sprints with user stories and use cases
- Added all issues to the project board with correct statuses
- Configured 9 board columns: Brainstorming, Backlog, Features, Todo, In Progress, In Review, Testing, Blocked, Done
- Sprint 1 issues closed (already completed), Sprint 2 set to Todo, Sprint 3–4 set to Backlog

---

### Session 1 — (Prior to CLAUDE.md)
**What was done:**
- Sprint 1 completed: CanonicalEvent, Source, Enums models created
- Basic folder structure established
- Test data verification in Program.cs

---

## GitHub Resources

* **Repo:** https://github.com/Jocke-1994/Samhallsinformation
* **Project Board:** https://github.com/users/Jocke-1994/projects/4
* **Labels:** user-story, use-case, feature, bug, infrastructure, sprint-1–4, priority:high/medium/low
* **Board Columns:** Brainstorming, Backlog, Features, Todo, In Progress, In Review, Testing, Blocked, Done

## Workflow Preferences

* Always create a new branch for new work
* Always explain changes and ask before pushing to remote
