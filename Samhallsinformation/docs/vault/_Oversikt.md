---
typ: index
---

# Översikt

Genereras automatiskt av Dataview — allt nedan läses live ur varje nots
frontmatter varje gång du öppnar den här sidan. Lägg till en ny funktions-
eller FAQ-not med rätt fält, och den dyker upp här av sig själv. Inget att
komma ihåg att uppdatera.

**Väntar något på ditt svar?** Se
[[1. Öppna_tankar/Öppna frågor|Öppna frågor]] — en samlad lista över allt
i valvet som genuint väntar på dig, oavsett vilken mapp det ligger i.

## Aktiva
Lanserade, live för besökare.

```dataview
TABLE grupp AS "Grupp", uiPlats AS "Var i appen", fallgropar AS "Fallgropar"
FROM "Funktioner"
WHERE status = "aktiv"
SORT grupp ASC, file.name ASC
```

## Pausade
Byggda men avstängda — väntar på ett beslut, inte på mer kod.

```dataview
TABLE grupp AS "Grupp", pausadVarfor AS "Varför pausad", fallgropar AS "Fallgropar"
FROM "Funktioner"
WHERE status = "pausad"
SORT sedan ASC
```

## Nedlagda

```dataview
TABLE grupp AS "Grupp"
FROM "Funktioner"
WHERE status = "nedlagd"
SORT file.name ASC
```

## Planerade
Funktioner-noter för sådant som redan är byggt fast dolt (sällsynt — de
flesta ej byggda idéer hör hemma i Idéer-sektionen nedan, inte här).

```dataview
TABLE grupp AS "Grupp"
FROM "Funktioner"
WHERE status = "planerad"
SORT file.name ASC
```

## Idéer
Inte byggda än. `pipelineNr` fylls i när/om idén läggs in i adminpanelens
riktiga idé-pipeline — tomt fält = bara i valvet ännu.

```dataview
TABLE status AS "Status", prioritet AS "Prioritet", uiGodkand AS "UI godkänd", beroenden AS "Beroenden", pipelineNr AS "Pipeline-nr"
FROM "Ideer"
WHERE typ = "ide"
SORT prioritet DESC, file.name ASC
```

## FAQ

```dataview
TABLE status AS "Status"
FROM "FAQ"
SORT file.name ASC
```

## Rutiner
Vad du faktiskt gör när en användare ber om hjälp med något — grunda
alltid svaret i den faktiska koden/mekanismen, inte minnet.

```dataview
TABLE kategori AS "Kategori", uppdaterad AS "Senast kollad mot koden"
FROM "Rutiner"
WHERE status = "aktiv"
SORT kategori ASC, file.name ASC
```

## Öppna beslut

```dataview
TABLE datum AS "Sedan"
FROM "Beslut"
WHERE status = "öppen"
SORT datum ASC
```

## Allt, oavsett status
Fallback-vy om ovanstående grupperingar missar något (t.ex. felstavad status).

```dataview
TABLE status AS "Status", grupp AS "Grupp", typ AS "Typ"
FROM "Funktioner" OR "FAQ" OR "Rutiner"
SORT status ASC, file.name ASC
```
