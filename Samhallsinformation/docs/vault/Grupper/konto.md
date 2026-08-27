---
typ: grupp
---

# Konto

Funktioner under Profil → Konto.

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
