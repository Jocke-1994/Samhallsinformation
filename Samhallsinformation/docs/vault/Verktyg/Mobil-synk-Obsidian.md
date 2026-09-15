---
typ: verktyg
status: att-gora  # giltiga värden: att-gora | pagaende | klart
---

# Mobilsynk för Obsidian (SI-valvet + framtida Bot-valv)

**Avvaktas 2026-09-12** — inte prioriterat just nu, planen ligger kvar
oförändrad för när det blir aktuellt.

Plan för att kunna skriva ner tankar/frågor i valvet från mobilen när man
inte är vid datorn, per projekt. Bakgrund: den här SI-vaulten ligger i
`Samhallsinformation/docs/vault/` — en undermapp i hela kodrepot, inte ett
eget litet repo. Repots faktiska git-historik är bara ~7,5 MB och de
spårade filerna ~3,9 MB (resten man ser lokalt, ~365 MB, är bara
byggartefakter som `bin/`/`obj/`/`node_modules/` — git rör dem aldrig).
Storlek är alltså inget hinder för att klona repot till en telefon.

Valt spår: **Obsidian Git-pluginet (gratis)**, inte Obsidian Sync (betalt,
~40 kr/mån). Anledning: ingen kostnad just nu, och valet är fullt
reversibelt — Obsidian Sync bryr sig inte om hur filerna kom dit, det går
att aktivera på en redan existerande valv-mapp när som helst senare (t.ex.
om Bot-projektet börjar dra in pengar och en betald lösning känns värd
det).

## Steg — Desktop (görs en gång)
1. Inställningar → Community plugins → sök "Obsidian Git" → installera +
   aktivera
2. Vaulten ligger tre nivåer ner i git-repot (inte i repo-roten) —
   pluginet har en inställning för just det ("vault path in git
   repository" / sub-folder-läge)
3. Testa en vanlig commit+push från datorn FÖRST, innan mobilen sätts upp
   — bekräftar att pluginet hittar rätt `.git` innan nästa steg bygger
   vidare på det

## Steg — Mobil
1. Installera Obsidian-appen (App Store/Play Store)
2. Skapa en tom vault i appen, aktivera Community plugins → installera
   "Obsidian Git" (fungerar numera på mobil, egen inbyggd git-motor, ingen
   extern app krävs i grundfallet)
3. Kör pluginets "Clone an existing remote repo"-kommando, peka på
   GitHub-repot (Jocke-1994/Samhallsinformation)
4. Behöver ett GitHub Personal Access Token (repo-scope) — klistras in i
   pluginets autentiseringsinställning. Token sparas lokalt i
   `.obsidian/`-mappen, som redan är gitignoread sedan session 41 — hamnar
   aldrig i repot
5. Efter kloning: öppna vaulten så att den pekar på
   `Samhallsinformation/docs/vault`-undermappen, inte repo-roten —
   annars syns all C#/TS-kod i Obsidians filutforskare också

**Osäkerhet, inte verifierad live än:** steg 5 (undermapp-vault + klona
hela repot på mobilen) är en mindre vanlig kombination för Obsidian
Git-pluginet — de flesta användare har hela repot = hela vaulten. Om det
krånglar på riktig telefon:

**Fallback:** en dedikerad git-app (t.ex. "Working Copy" på iPhone,
motsvarande på Android) klonar hela repot till telefonens filsystem, och
Obsidian öppnar bara undermappen som en vanlig mapp-vault (Obsidian bryr
sig inte om mappen är git-hanterad av en annan app). Git-appen sköter
commit/push/pull, Obsidian bara redigerar filer.

## Snabbfångst-mönster
En löpande fil att bara lägga till rader i från mobilen, triagera senare
vid datorn — t.ex. `_Frågor.md` i valvets rot eller en egen mapp. Samma
idé för Bot-valvet när det finns.

## Bot-projektet
Helt separat kodbas/repo (`kundtjanstbot-production.up.railway.app`) —
ingen koppling till SI-repot. Ett eget litet Obsidian-valv för Bot bör bli
antingen:
- en ny mapp i Bot-projektets egna repo (samma modell som SI, om det
  redan är gitat), eller
- en helt fristående mapp/repo bara för anteckningar, om Bot-koden inte
  ska bära på det

Obsidians vault-växlare (Ctrl/Cmd+O på desktop, motsvarande i mobilappen)
hoppar mellan SI- och Bot-valven på en knapptryckning — de behöver inte
vara samma valv för att kännas nära varandra i vardagen.

## Öppna frågor
- Fungerar undermapp-vault-läget på mobilen i praktiken, eller behövs
  fallback-git-appen direkt?
- När Bot-valvet sätts upp: eget repo eller fristående mapp?
