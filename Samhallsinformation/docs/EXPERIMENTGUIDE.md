# Experimentkort — guide

Filen du redigerar: `src/components/Profile/MinaKallor/index.tsx`
Experimentkortet börjar runt rad 55 och slutar runt rad 113.

---

## Knappar-sektionen (rad 62–68)

De sex exempelknapparna: Liten, Medium, Stor, Outline, Neutral, Destructive.
Ändra klasserna direkt på respektive `<button>` för att testa.

```
px-3/4/5  → horisontell padding (bredare knapp). Högre = mer luft till vänster/höger om texten.
py-1.5/2  → vertikal padding (högre knapp). Högre = mer luft ovanför/under texten.
text-xs   → liten text. Alternativ: text-sm (normal), text-base (större)
rounded-lg → rundade hörn. Byt till rounded-full för pillform.
```

---

## Badges-sektionen (rad 75–80)

```
px-2 py-0.5  → padding inuti badge. Öka för mer luft.
text-xs      → textstorlek
rounded-full → pillform
```

---

## Källrad — SMHI (Variant A, rad 89–92)

Enkel rad: namn till vänster, knapp till höger.

### Knappen (rad 91)
```
px-4       → horisontell padding inuti knappen
py-2       → vertikal padding inuti knappen
rounded-lg → kantiga hörn (inte pill)
text-sm    → textstorlek
```

### Raden (rad 89)
```
px-5 → luft till vänster/höger inuti raden (avstånd från kortets kant)
py-4 → luft ovanför/under hela raden
```

---

## Källrad — MSB (Variant B, rad 94–100)

Rad med namn + undertext (Nationell), knapp till höger.

### Knappen (rad 99)
```
px-24       → horisontell padding (just nu väldigt bred — sänk till px-6/px-8 för normal storlek)
py-3        → vertikal padding
text-base   → textstorlek (ett steg större än text-sm)
rounded-full → pillform
```

### Raden (rad 94)
```
px-5 → luft till vänster/höger
py-4 → luft ovanför/under
```

---

## Källrad — Polisen (Variant C, rad 102–108)

Rad med namn + badge, knapp till höger. Samma knappklasser som SMHI.

---

## Justera luft utanför knappen (avstånd från kortets kant)

Padding (`px`, `py`) styr luften **inuti** knappen — runt texten.
Margin styr luften **utanför** knappen — avståndet till omgivande element.

```
mr-2 → litet avstånd till höger om knappen (8px)
mr-4 → mellanstort avstånd (16px)
mr-6 → generöst avstånd (24px)
```

Lägg till `mr-4` direkt på `<button>`-elementet, t.ex:
```
<button className="px-4 py-2 mr-4 bg-violet-600 ...">+ Lägg till</button>
```

På samma sätt fungerar:
- `ml-` → luft till vänster om knappen
- `mt-` → luft ovanför
- `mb-` → luft nedanför

---

## OBS — viktigt att veta

- **Tailwinds spacing-skala hoppar**: px-1, px-2, px-3, px-4, px-5, px-6, px-8, px-10, px-12, px-14, px-16, px-20, px-24. Udda tal som px-7, px-9, px-15 ignoreras.
- **Godtyckliga värden**: Vill du ha exakt kontroll, skriv t.ex. `px-[40px]` — fungerar alltid.
- **overflow-hidden** är borttaget från källrads-containern (rad 87) — annars klipps knappar som hamnar nära kanten.
