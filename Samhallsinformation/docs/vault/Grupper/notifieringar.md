---
typ: grupp
---

# Notifieringar

Den äldre Notifieringar-sektionen (mail/SMS-modellen) — helt dold idag,
alla flaggor av. Push-notiser ligger numera under [[konto]] istället.

```dataview
TABLE status AS "Status", uiPlats AS "Var i appen"
FROM "Funktioner"
WHERE grupp = this.file.link
SORT status ASC, file.name ASC
```
