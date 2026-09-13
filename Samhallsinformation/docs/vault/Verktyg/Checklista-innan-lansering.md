---
typ: verktyg
status: att-gora  # giltiga värden: att-gora | pagaende | klart
---

# Checklista — innan en ny funktion går live

"Live" = användare kan faktiskt använda den (flaggan/knappen synlig för
riktiga konton, inte bara i sandlådan). Formaliserad 2026-09-12 från en
tanke i `1. Öppna_tankar/Flöde ny idé.md`. Tänkt att gås igenom innan en
feature-flag slås på för alla, inte bara vid stora lanseringar.

## Din ursprungslista
1. Den ska vara testad
2. Om det är en funktion som kan slås av/på av en användare, ska den
   fungera i användarens admin-detaljvy (så admin kan se/hjälpa till utan
   att själv behöva slå på funktionen för att kolla) — **exakt det som
   byggdes idag för push-inställningar**, första riktiga tillämpningen av
   den här punkten
3. Det ska finnas rutiner för hur den ska användas
4. Det ska finnas rutiner för admin/support hur man hanterar inkommande
   frågor
5. FAQ-info
6. Kundtjänstbot-info

## Mina förslag på fler punkter (ta bort/ändra fritt)
7. **Avstängningsbar** — ligger funktionen bakom en riktig feature-flag
   (inte hårdkodad "på"), så den går att slå av igen snabbt om något visar
   sig vara fel efter lansering?
8. **Loggad** — skriver funktionens admin-relevanta händelser till
   Aktivitetsloggen, samma mönster som alla andra admin-skrivsites
   (etablerat sedan wave 1, [[../Verktyg/Claudes-tankar]]-diskussionen)?
9. **GDPR-täckt** — om funktionen lagrar ny persondata, är den med i
   `GET /api/auth/me/export`? (Redan ett känt hål en gång — SMS-kanalen
   nämndes explicit som saknad i exporten trots att den aldrig byggdes)
10. **Mobiltestad**, inte bara desktop — hela den här veckans
    mobilgenomgång är ett bra exempel på varför
11. **Ärligt tomt-läge** — vad visas om funktionen inte har något att
    visa än (ingen data, ett fel)? Grundprincipen "transparens" (se
    CLAUDE.md) gäller lika mycket UI:t som notiser

## Öppna frågor
- Vill du ha kvar alla mina förslag (7–11), stryka några, eller lägga till
  fler av dina egna?
- Ska det här bli en bokstavlig checklista (kryssrutor) någonstans i
  Obsidian per funktion, eller bara en läslista att gå igenom i huvudet
  innan en flagga slås på?

## Kopplat
- [[../1. Öppna_tankar/Flöde ny idé|Flöde ny idé]] — ursprungstanken
- [[../Funktioner/Anvandarhantering-admin]] — punkt 2 tillämpad idag
