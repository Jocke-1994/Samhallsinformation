# Samhällsinformation — Versionsplan

## V1.0 — Ship inom 4 veckor

Enkel läsapp utan inloggning. Mål: få live data flödande och mäta användning via Google Analytics.

- Nyhetsflöde (Polisen + Krisinformation)
- Källfiltrering
- Google Analytics

**Backend:**
- `GET /api/events`
- `GET /api/sources`
- IngestorBackgroundService (Polisen + Krisinformation)
- Neon PostgreSQL + Railway

---

## V1.1 — Efter lansering

- Registrering / Inloggning
- Läst/oläst
- Mina källor (prenumerationer)
- Web Push-notiser

---

## V1.2+

- FAQ (redigerbar via admin)
- Admin: Källhantering
- Support-vy (Användare + Support-inbox)
- Rekommenderade källor
- Stör ej
- Leveransläge (avancerat)
- Notishistorik
- 2FA
- App-notiser (native)
- Sessioner & historik
- Aktivitetslogg
- Kända problem / Systemstatus / Planerat underhåll
- Ärendekort / Support-statistik
- Trafikverket
- SMS-notiser
