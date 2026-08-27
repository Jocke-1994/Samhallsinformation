---
typ: grupp
---

# Mina källor

Funktioner kopplade till att välja/hantera myndighetskällor.

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
