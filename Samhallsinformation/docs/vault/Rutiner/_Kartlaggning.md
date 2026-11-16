---
typ: kartlaggning
uppdaterad: 2026-11-09
---

# Kartläggning — vilka scenarion finns, och har vi en rutin?

Byggd 2026-11-09 på begäran: "vilka olika scenarion finns och vilka
rutiner har vi för varje scenario". Ingen tid att skriva ut alla som
fullständiga [[_Mall|Mall]]-rutiner just nu, så det här är en inventering
— per område, vilka scenarion som är kända (av kodgranskningarna,
sessionsloggen eller etablerad praxis) och om det finns en nedskriven
rutin eller inte. Nästa steg är att plocka ett par stycken i taget och
skriva ut dem på riktigt med `_Mall.md` som mall.

**Status-nyckel:** ✅ rutin finns · 🟡 etablerat mönster, inte nedskrivet
· ❌ känt scenario, ingen rutin alls · 🔧 kodfel som blockerar att en
rutin ens går att skriva förrän det är lagat.

## Konto
Rutiner finns redan för:
- ✅ [[Konto/Kan-inte-logga-in|Kan inte logga in]]
- ✅ [[Konto/Angra-radering|Ångra radering]]
- ✅ [[Konto/Radera-konto|Radera konto]]
- ✅ [[Konto/Byta-epost-problem|Byta e-post, problem]]
- ✅ [[Konto/Exportera-data|Exportera data]]
- ✅ [[Konto/Push-installningar|Push-inställningar]]

Gap:
- ❌ Byta lösenord — problem (skilt från "kan inte logga in")
- ❌ Ett konto skapat via Google som senare vill ha ett vanligt lösenord
  (eller tvärtom)

## Admin — lansering & drift av funktioner
- ✅ [[1. Rutiner för admin/Lansera en ny funktion|Lansera en ny funktion]]
- ❌ Rulla tillbaka/avpublicera en funktion som visar sig trasig EFTER
  lansering (lanseringsnoten täcker bara "stäng av flaggan", inget om
  Uppdateringar-texten, banderoller eller kommunikation ut)
- ❌ En schemalagd lansering som inte slår in som planerat (flagg-tid
  missad, push gick inte ut)

## Källhantering (Sandlådan → produktion)
- 🟡 Ny källa: etablerat mönster sedan session 60 (torrkör mot riktiga
  ingestorn lokalt → lägg in opublicerad i Sandlådan → efter ~1 vecka
  publicera/vänta/stryk) men aldrig skrivet som rutin-not
- 🔧 En publicerad källa börjar leverera trasig data: `IsActive=false`
  ensamt räcker inte, hämtning/push fortsätter om `IsPublished` inte
  också sätts (enhet-4, "Scenario: Trafikverket börjar leverera trasig
  data…"). Rutin bör skrivas, men först klargöra vilken kombination som
  faktiskt stoppar allt
- ❌ En källas flöde slutar fungera (RSS 404, bytt schema, fel
  Content-Type som i Ekobrottsmyndigheten-fallet session 60)
- ❌ Dubblettkälla/id-krock mellan en seedad ingestor och en
  admin-skapad källa med samma id (enhet-2)
- 🔧 En källa tas bort av misstag i adminpanelen — återskapas automatiskt
  vid nästa deploy om den är seedad, men inget bekräftelsesteg eller
  ångra i UI:t idag (enhet-6)

## Drift/incidenter
- 🔧 Produktions-databasen nere: Översikt/Felsökning visar falskt
  "Systemhälsa 100 %" istället för ett larm (enhet-6) — rutin kan inte
  skrivas förrän det visar rätt status
- ❌ Trasig deploy, behov av rollback på Vercel/Railway — ingen
  nedskriven rutin trots att båda plattformarna har inbyggd rollback
- ❌ Ett enskilt dataformat kraschar en ingestor permanent för alla
  källor i samma cykel (SMHI null-id, NUL-tecken i brödtext — enhet-3)
- 🟡 Osynliga styrtecken (U+00AD) i inläst text — känt och hanterat ad
  hoc sedan session 60, ingen skriven rutin för nästa gång det dyker upp
  i en ny källa

## Push-notiser
- ❌ Dubbelpush till en användare med flera enheter (enhet-3)
- ❌ Push fortsätter till en utloggad eller raderad användares enhet
  (enhet-3, enhet-5)
- 🔧 En avstängd/avpublicerad källa fortsätter pusha (samma rotorsak
  som källhanterings-gapet ovan)

## Support utanför Konto-kategorin
- ❌ Anonym feedback eller info@-ärende där ett schemalagt svar aldrig
  når kunden (ingen inloggning att se tråden i) — enhet-3
- ❌ Spoofad avsändaradress i inkommande supportmejl (enhet-1)
- 🔧 Support-rollen är i praktiken trasig (403 på det mesta i
  adminpanelen) — blockerar att skriva en riktig "vad gör en
  supportagent"-rutin förrän rollen faktiskt fungerar (enhet-4)

## Admin — användarhantering
- ❌ Massåtgärd (stäng av/radera flera konton) som träffar fel konto
  eller stoppar halvvägs utan tydlig feedback (enhet-6)
- ❌ "Logga in som"-funktionen visar supportagentens eget tomma konto
  istället för användarens, utan att varna (enhet-6)

## Säkerhet
- ❌ Massinloggningsförsök som kringgår rate limiting via spoofad
  `X-Forwarded-For` (enhet-1) — snarare en BE-uppgift att fixa än en
  rutin att dokumentera, men ingen av delarna finns idag
- ❌ Ett avstängt konto kan fortfarande agera tills dess token går ut
  (enhet-1)

## GDPR/data
- ✅ [[Konto/Exportera-data|Exportera data]]
- ✅ [[Konto/Angra-radering|Ångra radering]]
- ❌ En onormalt stor bevaknings-/sparad-lista som blir en
  prestandaincident för alla källor (enhet-4)

## Nästa steg
Prioritera utifrån vad som faktiskt dyker upp som riktiga ärenden, inte
efter hur allvarligt kodfyndet ser ut på pappret. Källhantering (🔧-raden
om `IsActive`/`IsPublished`) och lansering/rollback känns som de två mest
troliga att behövas snart, givet att 50 nya källor nyss lades in i
Sandlådan (session 60) och ska granskas ~15 nov.
