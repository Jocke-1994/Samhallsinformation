---
typ: grupp
---

# Admin

Funktioner som lever i Adminpanelen (inte en enskild användarinställning).
Se även din egen `Adminpanel/`-mapp för själva panelens sidstruktur — den
här tabellen visar bara vilka `Funktioner/`-poster som hör hit.

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
