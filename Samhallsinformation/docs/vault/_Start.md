---
typ: index
---

# Samhällsinformation — valv

Det här är ett testvalv. Öppna den här mappen (`docs/vault`) i Obsidian och klicka
dig runt i de fyra exempelnoterna för att se hur länkning/backlinks/grafvy känns
innan vi bestämmer om vi bygger vidare på riktigt.

## Exempelnoter
- [[Sparat]]
- [[Push-notiser]]
- [[Aktivitetslogg]]
- [[FAQ - Hur sparar jag en handelse]]

## Mall för en funktionsnot
Kopiera det här när vi bygger vidare:

```
---
status: aktiv | nedlagd | planerad
typ: funktion
---

# Namn

Kort beskrivning.

## Status
Sedan när, PR-nummer, ev. varför nedlagd.

## Kopplat
- [[Annan funktion]]
- [[FAQ - ...]]

## Teknisk plats
Filer/tabeller/endpoints.
```

## Mall för en FAQ-not
```
---
status: aktiv | nedlagd
typ: faq
---

# FAQ - frågan ordagrant

Vad svaret faktiskt säger idag (eller vad det borde säga).

## Kopplat
- [[Funktionen frågan handlar om]]
```
