---
typ: grupp
---

# Support

Ärendehantering, Systemstatus, FAQ under Profil → Support.

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
