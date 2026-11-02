---
typ: claude-logg
uppgift: Göra om en minnesregel till ett automatiskt test
uppgiftstyp: skyddsnät (inte en funktion)
start: 2026-11-02
pr: 707
---

# Logg — Migrationsregeln som test

Den första förbättringen som kom ur att rita flödet: **en regel som bara fanns i Claudes minne blir ett test som alltid körs.** Kortare logg än [[Logg - Vad är nytt]].

## Vad jag gjorde → varför
1. **Letade upp ett test som redan läser källkod** (flaggparitetstestet) → *kopiera ett beprövat sätt att hitta filerna i stället för att uppfinna ett.*
2. **Räknade alla gamla migrationer innan jag skrev testet** (42 riskabla, 38 med block, 4 utan) → *ett nytt skyddsnät får inte bli rött direkt på historik som redan är löst. Annars stänger man av det.*
3. **Kollade att de 4 utan block verkligen var hanterade** på annat sätt → *ett undantag utan bevis är bara ett hål.* Alla 4 hade en förklaring och blev en fryst lista.
4. **Provkörde den striktare regeln** ("rätt typ, inte bara att blocket finns") som ett snabbt skript först → *billigare att se om den håller innan den skrivs som ett riktigt test.*
5. **Lade till ett "testar testet"-test** → *om EF ändrar format kan sökningen tyst sluta hitta något, och då hade allt blivit grönt.*
6. **Ett bygge låstes av en kvarglömd process.** Jag kollade VEMS process det var innan jag stängde den → *du kör ibland två sessioner; det var min egen rest från förra uppgiften.*
7. **Bröt regeln med flit två gånger** och såg testet bli rött, sedan återställt → *ett skyddsnät som aldrig varit rött är obevisat.*

## Jämfört med diagrammen
- [[Välja tester]] säger "buggfix: visa felet först". **Samma idé gällde här, fast för ett skyddsnät:** visa att det larmar innan du litar på det. Förslag: lägg till det i diagrammet.
- Steg 2 (läsa på) blev det största steget, precis som för en buggfix. Själva testet var snabbt att skriva. Att veta vad det inte fick larma på tog tid.
- **Städning efter förra uppgiften saknas i flödet.** Den kvarglömda processen kom från Vad är nytt. Förslag: "stäng det du startat" som sista punkt i *Lämna över*.
