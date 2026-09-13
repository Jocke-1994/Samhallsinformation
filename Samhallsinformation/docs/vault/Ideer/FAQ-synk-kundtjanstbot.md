---
typ: ide
status: redo-for-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Kräver ett litet motsvarande arbete i det separata kundtjänstbot-projektet (deras #220) — den här planen täcker bara vår sida"
prioritet: ej-bedomd
pipelineNr: ""
kalla: "FAQ/0. Kopplas mot kundtjänst botten.md"
---

# FAQ-synk mot kundtjänstboten — hur håller vi den uppdaterad?

Formaliserad version av frågan i `FAQ/0. Kopplas mot kundtjänst botten.md`:
hur kopplar vi FAQ mot kundtjänstboten så den aldrig blir daterad?

## Bakgrund
Redan känt sedan session 47 (2026-09-09): kundtjänstboten är en fristående
AI-hybrid i ett eget projekt (fuzzy-matchad kunskapsbank → Claude-fallback
som växer KB:n automatiskt). En riktig KB-synk mot vår FAQ är redan
identifierad DÄR som en billig mellanlösning (#220 i kundtjänstbot-
projektet), som alternativ till ett större epic med live function-calling
mot vårt events-API (#203, parkerat, mycket större jobb).

## Verklig teknisk lucka hittad 2026-09-12
`GET /api/faq` (publikt — den rimliga endpointen för en extern konsument)
filtrerar BARA på `Publicerad`, inte på om frågans `FlagKey` faktiskt är
aktiv just nu. Det är medvetet och dokumenterat (`FaqItem.cs`) — flaggornas
`defaultAktiv`-värden finns bara i frontendens `featureFlags.ts`, backend
känner bara till admins avvikelser (`FeatureFlagOverrides`). Fungerar idag
eftersom enda konsumenten är vår egen frontend, som filtrerar om det själv.

En extern konsument som läser `/api/faq` direkt (kundtjänstboten) skulle
däremot få med frågor vars kopplade funktion är avstängd — boten skulle
kunna svara på frågor om något som inte ens syns i appen. Måste lösas
oavsett vilken synk-mekanism som väljs nedan.

## Föreslagen ordning
1. ✅ **Fixa filtreringsluckan i `/api/faq`** — **byggt 2026-09-13, PR #573.**
   `Application/FeatureFlags/FeatureFlagDefaults.cs` speglar
   `defaultAktiv`-värdena, sammanslaget med `FeatureFlagOverrides`.
   `GET /api/faq` returnerar nu bara frågor där `Publicerad = true` OCH
   (`FlagKey` är null ELLER flaggan är effektivt aktiv). `FaqKort.tsx`
   rördes medvetet inte — dess egen filtrering är nu bara en ofarlig
   dubblering, inte borttagen. Risken (två källor till `defaultAktiv` kan
   glida isär) kvarstår, ohanterad — kräver disciplin vid framtida flaggor.

2. ✅ **`UpdatedAt` på `FaqItem`** — **byggt 2026-09-13, samma PR.** Sätts
   vid varje `UpdateFaq`, migration med backfill från `CreatedAt` i
   produktion.

3. **Synk-mekanism — rekommendation: periodisk polling** (matchar #220)
   - Kundtjänstboten pollar `GET /api/faq` med jämna mellanrum (t.ex. varje
     timme, eller vid sessionsstart) och bygger om sin kunskapsbas.
   - Fördel: ingen ny endpoint/autentisering på vår sida utöver punkt 1–2,
     inget delat hemligt nyckelutbyte mellan projekten.
   - Nackdel: en fördröjning upp till pollingintervallet — acceptabelt för
     FAQ-innehåll som ändras sällan och inte är tidskritiskt.
   - Alternativ (webhook/push vid varje FAQ-ändring) är mer omedelbart men
     kräver autentiserad webhook, delad hemlighet, felhantering om boten är
     nere — inte värt det för FAQ-innehåll. Föreslår att inte bygga det.
   - **Lättare mellanväg, tillagd 2026-09-12:** en "ping"-webhook som bara
     säger "något har ändrats, hämta om nu" — inget innehåll i pinget,
     boten pollar bara om direkt via samma `GET /api/faq` den redan
     använder. Löser fördröjningen vid t.ex. en pågående incident utan att
     bygga en full push-integration (inget schema att komma överens om,
     bara en trigger). Inte beslutat, men värt att ha med om ren polling
     känns för långsam.

4. **Cross-project-avstämning — vår halva är klar, redo att skicka**
   Vår sida (punkt 1–2) är byggd. Nästa steg görs i kundtjänstbot-
   projektet — här är ett färdigt meddelande att kopiera dit när du vill:

   ---
   📋 **Till kundtjänstbot-projektet** (kopiera till den sessionen):

   Samhällsinformation-projektet har nu byggt sin halva av FAQ-synken som
   redan är känd hos er som #220 (periodisk KB-synk). Kontraktet:
   `GET https://[produktions-URL]/api/faq` — publikt, ingen autentisering,
   returnerar en JSON-lista av `{ id, kategori, fraga, svar, flagKey,
   createdAt, updatedAt }` för ENDAST de frågor som just nu faktiskt är
   synliga för en riktig besökare (redan filtrerat på både publicerad-
   status och om den kopplade funktionen är aktiv — ni behöver inte
   duplicera den logiken). `updatedAt` sätts om vid varje redigering, så
   ni kan avgöra om något ändrats sedan er senaste hämtning utan att
   jämföra hela listan. Rekommenderat pollingintervall från vår sida: en
   gång per dygn räcker troligen (FAQ ändras sällan), men det är ert val.
   Hör av er om ni vill ha något annat i svaret.
   ---

   Byt ut `[produktions-URL]` mot den riktiga adressen innan du skickar.

## Öppna frågor — status 2026-09-13
- ✅ **Bygga nu eller vänta?** Besvarat: du ville ha det fixat så snart som
  möjligt, du ser potential i funktionen. Byggt (se punkt 1–2 ovan).
- **Pollingintervall — vad frågan egentligen handlar om:** hur ofta SKA
  kundtjänstboten hämta vår FAQ-lista på nytt (t.ex. en gång i timmen,
  en gång per dygn)? Det bestämmer hur snabbt en ändring du gör i FAQ
  (ny fråga, redigerat svar, en funktion stängs av) syns för boten. Ett
  kort intervall (varje timme) känns onödigt eftersom FAQ ändras sällan;
  ett långt (en gång per dygn) räcker troligen, kombinerat med
  ping-idén för de sällsynta gångerna det brådskar. Den här siffran
  bestäms egentligen i KUNDTJÄNSTBOT-projektet (de äger pollingen), inte
  här — vår del är bara att se till att `/api/faq` alltid är sanningsenlig
  oavsett när den läses.

## Tillägg 2026-09-12 — tre-läges-status för flaggor (större, separat idé)
Uppföljande fråga från dig: räcker på/av, eller behövs ett tredje läge —
"lanserad men tillfälligt pausad, ingen känd ETA" — skilt från "finns
inte alls"? Konkret exempel: push-notiser tillfälligt avstängda pga en
pågående incident. En bot som bara ser "av" kan antingen låtsas att
funktionen inte finns, eller svara fel — ingen bra om något faktiskt är
trasigt just nu. Med ett tredje läge skulle boten istället kunna svara
"det här är känt och tillfälligt, kontakta supporten" — mer hjälpsamt än
båda ytterligheterna.

Det här är en riktig lucka, men en EGEN, större uppgift — den rör
`FeatureFlagOverrides`, `featureFlags.ts`, adminpanelens UI och FAQ-
kopplingen samtidigt, inte bara `/api/faq`. Medvetet inte en del av
grundfixet (punkt 1 ovan), som bara handlar om binär filtrering. Sparad
här som en uppföljande idé — inte beslutad, inte scopad i detalj än.

## Kopplat
- Kundtjänstbot-projektets #220 (periodisk KB-synk, redan känt sedan
  session 47)
- Kundtjänstbot-projektets #203 (fullt live function-calling mot
  events-API, parkerat, separat och större)
