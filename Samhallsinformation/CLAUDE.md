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

### Session 5 — 2026-06-10 (Current)
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
