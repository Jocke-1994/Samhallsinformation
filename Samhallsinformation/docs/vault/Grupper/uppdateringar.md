---
typ: grupp
---

# Uppdateringar

Changelog-sidan (publik "Nyheter" + inloggad "Uppdateringar").

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
