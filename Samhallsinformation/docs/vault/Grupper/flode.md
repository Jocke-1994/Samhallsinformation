---
typ: grupp
---

# Flöde

Funktioner kopplade till själva nyhetsflödet (Allt/Mitt flöde).

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
