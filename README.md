# Samhällsinformation

[![Frontend CI](https://github.com/Jocke-1994/Samhallsinformation/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/Jocke-1994/Samhallsinformation/actions/workflows/frontend-ci.yml)
[![Backend CI](https://github.com/Jocke-1994/Samhallsinformation/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/Jocke-1994/Samhallsinformation/actions/workflows/ci-backend.yml)

Samhällsinformation samlar offentlig information från svenska myndigheter,
länsstyrelser, regioner och kommuner på ett ställe och presenterar den som
ett personligt nyhetsflöde — utan att tolka, redigera eller lägga till egna
åsikter i källmaterialet.

**Live:** [samhallsinformation.se](https://samhallsinformation.se)

Projektet är ett skolprojekt inom .NET 25-utbildningen, men drivs och
driftas som en riktig produkt.

## Grundprinciper (bryts aldrig)

1. **Ingen opinionsbildning** — systemet skapar inget eget innehåll eller åsikter.
2. **Ingen tolkning** — information omformuleras aldrig, bara förmedlas.
3. **Källkrav** — ingen information visas utan en verifierad primär källa.
4. **Transparens** — det ska alltid vara tydligt varför en notifiering skickades eller uteblev.

## Teknikstack

| Del | Teknologi |
|-----|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | C# / .NET 10, ASP.NET Core Web API |
| Databas | SQLite (lokalt) / PostgreSQL (produktion) via Entity Framework Core |
| Bakgrundstjänst | `IngestorBackgroundService` — hämtar nya händelser löpande från varje källas ingestor |
| Drift | Vercel (frontend), Railway (backend + databas), Resend (e-post) |

## Struktur

```
Samhallsinformation/
├── backend/            ASP.NET Core Web API (Controllers, Application, Infrastructure, Ingestors, Models, Data)
├── backend.Tests/      xUnit-tester för backend
├── frontend/           React/TypeScript/Vite-app
└── docs/               Källöversikt, roadmap, Obsidian-valv m.m.
```

Se `PROJEKT.md` för en djupare projektöversikt och `Samhallsinformation/CLAUDE.md`
för arbetssätt och konventioner i repot.

## Kom igång lokalt

Krav: [.NET 10 SDK](https://dotnet.microsoft.com/download) och [Node.js 22+](https://nodejs.org/).

**Backend**

```bash
cd Samhallsinformation/backend
dotnet restore
dotnet run
```

API:t körs som standard på `http://localhost:5000`. Utan `RESEND_API_KEY`
satt faller e-postutskick tillbaka till loggning i stället för att skicka
riktiga mejl.

**Frontend**

```bash
cd Samhallsinformation/frontend
npm install
npm run dev
```

## Tester

```bash
# Backend (hela sviten kräver Docker för Postgres/Testcontainers-tester)
cd Samhallsinformation
dotnet test

# Backend utan Docker
dotnet test --filter "Category!=Postgres"

# Frontend
cd Samhallsinformation/frontend
npm test
npm run lint
```

## API (urval)

Bas-URL lokalt: `http://localhost:5000`

| Endpoint | Beskrivning |
|----------|-------------|
| `GET /api/sources` | Alla aktiva myndigheter/källor |
| `GET /api/events` | Händelser, med filter: `?source`, `?geography`, `?national`, `?page` |
| `GET /api/events/{id}` | En specifik händelse |

## Roller

| Roll | Behörighet |
|------|-----------|
| `User` | Standardroll — nyhetsflöde + profilinställningar |
| `Support` | Kan hantera ärenden, se systemstatus och FAQ |
| `Admin` | Full åtkomst till alla delar av systemet |

## Mer dokumentation

- [`PROJEKT.md`](PROJEKT.md) — projektöversikt, vision och applikationens lager
- [`Samhallsinformation/CLAUDE.md`](Samhallsinformation/CLAUDE.md) — arbetssätt, agent-roller och konventioner
- [`Samhallsinformation/docs/SESSIONSLOGG.md`](Samhallsinformation/docs/SESSIONSLOGG.md) — historik över alla utvecklingssessioner
- [`Samhallsinformation/docs/kallor/`](Samhallsinformation/docs/kallor/) — källöversikt och roadmap mot fler myndigheter/kommuner
- [`TERMINOLOGI.md`](TERMINOLOGI.md) — begrepp som används i projektet
- [`ER-Diagram.txt`](ER-Diagram.txt) — datamodell
