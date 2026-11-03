---
typ: verktyg
skapad: 2026-11-03
---

# Lanseringar november 2026 — texter till Uppdateringar

Textutkast till de tre nyheter som läggs in i Admin → Uppdateringar →
+ Ny uppdatering. Lanseringsplanen beslutades 2026-11-02, alla lanseringar
kl. 09:00 (se [[Schemalagd-lansering]] och rutinen "Lansera en ny funktion").

Version 1.0 (inloggningen) och 1.1 (platsfilter m.m., 3 nov) ligger redan inne.

Inloggade = funktionen kräver konto. Prova själv = färdig länk i nyheten.

---

## 1.2 — Push-notiser

- **Titel:** Få en notis när något händer
- **Annonsering:** tis 3 nov (direkt). Kortare än en vecka, beslutat 2 nov
- **Lansering:** fre 6 nov 09:00
- **Flagga som slås på:** `notif_push`
- **Visa som Vad är nytt:** ja
- **Banderoll:** ja (blir "Användare", alla punkter är för inloggade)
- **Skicka push:** nej. Ingen har push påslaget innan lanseringen, så den når ingen

| Typ | Plats | Syns för | Prova själv | Text |
|---|---|---|---|---|
| Ny funktion | Konto | Inloggade | Knapp: Aktivera push-notiser | Push-notiser – få en notis i mobilen eller datorn när det kommer något nytt från dina källor. Har du Polisen-bevakningar får du bara notiser om det som matchar dem. |

En punkt i stället för tre (ändrat 2026-11-03 på användarens begäran): de två
extra punkterna var förklaring av hur push fungerar, inte egna funktioner.

Prova själv = **Knapp: Aktivera push-notiser** (PR #717, 2026-11-03): under
texten visas en ruta "Vill du aktivera push-notiser?" med en Aktivera-knapp
som slår på båda kategorierna (Ny händelse + Ny version). Därför är meningen
"Slå på under Konto → Push-notiser." struken ur texten.

## 1.3 — Dela

- **Titel:** Dela en händelse
- **Annonsering:** fre 6 nov 09:00
- **Lansering:** fre 13 nov 09:00
- **Flagga som slås på:** `flode_dela`
- **Visa som Vad är nytt:** ja
- **Banderoll:** ja (blir "Alla", funktionen finns även utan konto)
- **Skicka push:** ja, vid lansering (push är live sedan 6 nov)

| Typ | Plats | Syns för | Prova själv | Text |
|---|---|---|---|---|
| Ny funktion | Nyhetsflöde | Alla | – (inget mål finns) | Dela en händelse – tryck på dela-ikonen på en händelse för att skicka länken till källan vidare, till exempel i ett sms eller i sociala medier. |

## 1.4 — Sparat

- **Titel:** Spara händelser till senare
- **Annonsering:** fre 13 nov 09:00
- **Lansering:** fre 20 nov 09:00
- **Flagga som slås på:** `flode_sparat`
- **Visa som Vad är nytt:** ja
- **Banderoll:** ja (blir "Användare")
- **Skicka push:** ja, vid lansering

| Typ | Plats | Syns för | Prova själv | Text |
|---|---|---|---|---|
| Ny funktion | Nyhetsflöde | Inloggade | Mitt flöde → Sparat | Spara händelser – tryck på bokmärket på en händelse för att spara den. Du hittar dem under Mitt flöde → Sparat. |

---

## Status

- [ ] 1.2 Push inlagd
- [ ] 1.3 Dela inlagd
- [ ] 1.4 Sparat inlagd
