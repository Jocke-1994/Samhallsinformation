---
typ: beslut
status: stängd
datum: 2026-09-25
---

# Beslut - Migreringsskydd vid start (V2-1)

**Löst 2026-09-28: PR #605 mergad.** Användaren valde **Alt A, ursprungsversionen** — krascha vid ett probe-fel, aldrig gissa. (PR "Migreringsstart tappar aldrig data", V2-1 i åtgärdsplanen, se [[Code-review 2026-09-25]].)

Mellan att PR:en öppnades och mergades hade V4-6b (PR #657) flyttat hela schema-setup-blocket ur `Program.cs` till `Infrastructure/DatabaseBootstrapper.cs`. Konflikten löstes genom att flytta `StartupSchemaGuard`-anropet dit, ordagrant samma logik — `Program.cs` verifierat byte-för-byte identisk med `main` efteråt. Verifierat live: produktionen (som har data, alltså `Migrate`-vägen) startade normalt efter deploy, ingen "Startavbrott"-rad i Railway-loggen.

## Problemet (fynd E2#2, hög påverkan / låg sannolikhet)
Vid start körs `catch { alreadyMigrated = false; }` och om det blir "false" körs `DROP TABLE` på Events, Sources, UserPreferences och migreringshistoriken. Ett kortvarigt anslutningsfel när Railway startar om appen (eller vilket undantag som helst) tolkas som "ingen historik" → all produktionsdata i de tabellerna kan raderas.

## Vad PR:en gör (ursprungsversionen, den som ligger på GitHub)
En ren beslutsfunktion avgör: historik finns → kör vanligt; ingen historik men data finns → **avbryt start** med tydligt fel (droppa aldrig data); ingen historik och tomt → får återställa; **kunde inte undersöka databasen → avbryt start** (aldrig DROP).

## Frågan
Undersökningen är SQL mot PostgreSQL (`to_regclass` + `count(*)`), som **inte kunde testas mot riktig PostgreSQL** (ingen Docker/Postgres lokalt). Om den SQL:en av något skäl kastar mot Railway, kraschar appen vid start i produktion med ursprungsversionen.

- **A. Merga ursprungsversionen** — dataförlust omöjlig; risk för att appen inte startar om proben är felaktig (syns direkt efter deploy, går att backa via revert).
- **B. Godkänn Claudes ändring (rekommenderas)** — undersökningsfel blir *icke-fatala*: aldrig `DROP`, men appen går vidare till vanliga `MigrateAsync` (som kastar som förut om databasen faktiskt är nere). Då kan en trasig probe aldrig ta ned appen. Ändringen är gjord i en arbetskopia men **blockerades av en behörighetsspärr** ("Security Weaken", eftersom den mjukar upp ett startskydd), så den är inte pushad.
- **C. Merga inte** — dataförlustbuggen kvarstår.

Efter deploy av A eller B: kolla att Railway-loggen visar att start går igenom utan raden "Startavbrott".

## Kopplat
- [[Code-review 2026-09-25]]
