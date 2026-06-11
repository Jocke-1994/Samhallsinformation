# Samhällsinformation — Projektöversikt

## Vad är det?

Samhällsinformation är en webbapplikation som samlar och presenterar offentlig information från svenska myndigheter på ett och samma ställe. Användaren prenumererar på de myndigheter de vill följa (t.ex. Polisen, SMHI, MSB) och får ett personligt nyhetsflöde med händelser från just dessa.

Projektet är ett skolprojekt inom .NET 25-utbildningen.

## Varför finns det?

Offentlig information från myndigheter är ofta utspridd på många olika sajter med olika format och uppdateringsfrekvens. Samhällsinformation löser det genom att automatiskt hämta och normalisera händelser från flera källor till ett enhetligt flöde — utan att lägga till egna åsikter, tolkningar eller redigering.

## Grundprinciper (bryts aldrig)

1. **Ingen opinionsbildning** — Systemet skapar inget eget innehåll eller åsikter.
2. **Ingen tolkning** — Information omformuleras aldrig. Systemet förmedlar bara vad källan säger.
3. **Källkrav** — Ingen information visas utan en verifierad primär källa.
4. **Transparens** — Systemet ska alltid vara tydligt med varför en notifiering skickades eller uteblev.

## Teknikstack

| Del | Teknologi |
|-----|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | C# / .NET 8+, ASP.NET Core Web API |
| Databas | SQLite via Entity Framework Core (PostgreSQL vid publicering) |
| Bakgrundstjänst | `IngestorBackgroundService` — hämtar nya händelser var 5:e minut |

## Applikationens tre lager

```
Publik (ingen inloggning)
├── Startsida — nyhetsflöde
├── FAQ-sida
├── Kontaktformulär
└── Ansök om att bli källa

Inloggad användare
└── Profil (/profil)
    ├── Mina källor    — välj vilka myndigheter som visas
    ├── Notifieringar  — e-post/SMS-regler per källa, geografi och allvarlighetsgrad
    ├── Konto          — namn, e-post, lösenord, GDPR
    └── Uppdateringar  — changelog

Admin-dashboard (/admin, ej publik)
├── Översikt / Statistik
├── Källhantering
├── Användarhantering & roller
├── Support-inbox
├── Aktivitetslogg
└── Felsökningsverktyg
```

## Roller

| Roll | Behörighet |
|------|-----------|
| `User` | Standardroll — nyhetsflöde + profilinställningar |
| `Support` | Kan hantera ärenden, se systemstatus och FAQ |
| `Admin` | Full åtkomst till alla delar av systemet |

Det första kontot som registreras får automatiskt Admin-rollen. Fallback: seed-admin via miljövariabel.

## Design

- **Tema:** Ljust — `slate-50` bakgrund, vita kort och sidebar, `violet-600` som accentfärg
- **Layout:** Fast sidebar till vänster (`w-56`), innehållsyta till höger
- **Sidbar:** Logotyp → Inställningslänkar → Källknappar (med oläst-markering) → Profilkort
- **Kortdesign:** `rounded-2xl`, `shadow-sm`, `border border-slate-200`
- **Språk:** Gränssnittet är alltid på svenska

## API (backend)

Bas-URL lokalt: `http://localhost:5000`

| Endpoint | Beskrivning |
|----------|-------------|
| `GET /api/sources` | Alla aktiva myndigheter/källor |
| `GET /api/events` | Händelser med filter: `?source`, `?geography`, `?national`, `?page` |
| `GET /api/events/{id}` | En specifik händelse |

## Vad som är klart (maj 2026)

- Nyhetsflöde med källfiltrering och läst/oläst-hantering
- Profilsida med Mina källor, Notifieringar, Konto och Uppdateringar
- Admin-dashboard (Översikt + Källhantering) — bakom env-guard, ej publik
- Sidebar med navigation och källknappar

## Vad som återstår

- Admin: Användarhantering, Support-inbox, Aktivitetslogg, Felsökning
- Publika sidor: FAQ, Kontaktformulär, Ansök om källa
- Autentisering (backend)
- Undersökningar-fliken i profilen
- Support-roll och dedikerad support-vy

---

## Långsiktig vision

### Täcka hela Sverige
Målet är att på sikt täcka alla svenska myndigheter, alla 21 länsstyrelser, alla 21 regioner och alla 290 kommuner (~340 källor totalt). Se `docs/kallor/OVERSIKT.md` för detaljerad roadmap och API-information.

### Kommuner som användare — manuell onboarding
Många kommuner saknar strukturerade API:er eller RSS-flöden. Tanken är att de ska kunna bli *användare* av systemet och manuellt skicka in händelser via en ticket-funktion — som en brygga tills en automatiserad lösning är på plats.

Flödet skulle se ut så här:
1. Kommunen registrerar sig och får en Source-roll i systemet
2. De kan skapa händelse-tickets manuellt (titel, innehåll, geografi, allvarlighetsgrad) eller skicka in en PDF
3. Admin granskar och publicerar händelsen i flödet
4. När kommunen väl har ett API eller RSS-flöde kan en ingestor byggas och manuell hantering fasas ut

Det här öppnar även för ett konsultscenario — kommuner som ser värdet av plattformen kan höra av sig och be om hjälp att bygga en integration anpassad för just deras system.
