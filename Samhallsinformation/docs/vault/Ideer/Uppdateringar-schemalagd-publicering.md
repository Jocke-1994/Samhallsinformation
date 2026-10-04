---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ja
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 24, ursprungsspec — aldrig migrerad till valvet innan nu (skrivet i minnessystemet, inte hit)"
---

# Uppdateringar — schemalagd publicering

Ursprunglig, bredare vision (session 24, 2026-07-30): schemalagd
changelog-publicering kopplad till pushnotiser, djuplänkning och
schemalagd källaktivering, med ett konkret exempel (en ny källa,
"Migrationsverket") som fick berättas om FÖRE den faktiskt gick live,
och en möjlighet att förhandsprenumerera på den väntande källan.

**Byggt 2026-09-21** (se [[../Verktyg/Schemalagd-lansering|Schemalagd
lansering]] för hela flödet): schemalagd publicering av en Uppdateringar-
post OCH schemalagd aktivering av kopplade feature-flaggor, från ett
samlat ställe i admin.

**Medvetet INTE byggt den här omgången** (fortfarande bara idé):
- Automatisk pushnotis-koppling — push ("Ny version") förblev en separat,
  manuell knapp. Se den öppna frågan i [[../Verktyg/Schemalagd-lansering]].
- Djuplänkning från push/nyhetspost till rätt ställe i appen (t.ex. Mina
  källor med en ny källa highlightad) — se
  [[../../project_notiser_funktionslansering_deeplink]] i minnet (aldrig
  migrerad till valvet).
- Förhandsprenumeration — "aktivera automatiskt åt mig när den släpps"
  ikryssat i en väntande nyhetspost.

## Beslut 2026-10-03
Avvakta — inga av de tre kvarvarande punkterna (push-koppling, djuplänk,
förhandsprenumeration) byggs förrän ett konkret behov dyker upp.

## Kopplat
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — det faktiska
  byggda flödet, teknisk karta och designresonemang
