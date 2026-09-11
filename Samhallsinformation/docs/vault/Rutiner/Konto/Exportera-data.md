---
kategori: "GDPR & uppgifter"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare vill ha ut sin data (GDPR-export)

Utlöses av: en fråga om vilken data vi har, eller ett formellt
GDPR-dataportabilitetskrav (artikel 20).

## Självbetjäning
**Konto → Datahantering → Exportera data** (samma kort som radering, se
[[Radera-konto]]). Laddar ner en JSON-fil direkt i webbläsaren — inget
väntetid, ingen mejlbekräftelse. Peka användaren dit om de kan logga in.

## Om det kommer in som ett supportärende
1. Om användaren kan logga in: peka på självbetjäningen ovan, det är
   snabbare än att admin gör det manuellt
2. Om de INTE kan logga in: se [[Kan-inte-logga-in]] först — det finns
   **inget admin-verktyg** för att exportera åt en användare (se
   Gränser), så återställ inloggningen innan du kan hjälpa med exporten

## Adminverktyg / fallback
Finns inte. Export är enbart självbetjäning, bundet till den inloggade
sessionens egna JWT — ingen `GET /api/admin/users/{id}/export`-motsvarighet
byggd.

## Teknisk plats
`GET /api/auth/me/export` (AuthController.ExportMe). Innehåller
kontouppgifter, källor, sparade händelser, Polisen-filter,
notisinställningar+leveranshistorik, supportärenden (interna
anteckningar exkluderade). Se [[../../Funktioner/GDPR-verktyg]].

## Gränser / vad du INTE ska göra
- Skicka ALDRIG en användares data manuellt hopplockad från databasen
  via mejl — om de inte kan logga in, lös inloggningsproblemet först
  (se [[Kan-inte-logga-in]]) så de kan använda den riktiga
  export-funktionen, som garanterat är komplett och konsekvent
