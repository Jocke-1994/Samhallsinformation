# Kunskapsbas-underlag för kundtjänstboten

Tänkt att kopieras in i kundtjänstbotens (`kundtjanstbot-production.up.railway.app`)
egna admin-panel/kunskapsbas — inte kod i det här repot, bara källmaterial.

**Viktigt om vad som faktiskt inkluderats:** flera frågor i den befintliga
webb-FAQ:n (`INITIAL_FAQ` i `faqStorage.ts`) beskriver funktioner som just nu
är avstängda eller inte gör något på riktigt (SPAR-adressförslag som togs
bort, Radera konto/GDPR-export som inte fungerar). De har INTE tagits med här.
Den här listan innehåller bara det jag kunnat verifiera är genuint live och
fungerande just nu (2026-08-04), utifrån `featureFlags.ts`s `defaultAktiv`-
värden och tidigare sessioners upptäckter.

**Osäkert, kolla innan det läggs in:** fungerar "Spara" på Kontoinformation
och Lösenordsbyte faktiskt (kopplade mot `PUT /api/auth/me`), eller är de
fortfarande bara UI utan backend-koppling (flaggat som ej gjort i session 25,
inte adresserat sedan)? Utelämnat nedan tills det är bekräftat.

---

## Allmänt

**Vad är Samhällsinformation?**
En webbsida som samlar viktig information från svenska myndigheter — polisen,
krisinformation.se, SMHI och fler — på ett och samma ställe. Vi skriver aldrig
om eller tolkar informationen, vi visar bara vidare det myndigheten själv sagt,
med en länk till källan.

**Behöver jag ett konto för att använda sidan?**
Nej, du kan läsa alla händelser utan konto. Ett konto ger dig möjlighet att
välja vilka källor du vill följa och spara dina inställningar.

## Källor och flöde

**Hur lägger jag till eller tar bort källor?**
Gå till Mina källor i profilmenyn. Under "Alla källor" ser du samtliga
tillgängliga myndigheter — klicka för att lägga till. Aktiva källor visas i
en egen lista där du också kan ta bort dem.

**Vad är skillnaden mellan "Alla händelser" och "Mitt flöde"?**
"Alla händelser" visar allt, oavsett vad du valt att följa. "Mitt flöde" (bara
för inloggade) visar bara händelser från källorna du faktiskt lagt till under
Mina källor.

## Konto

**Kan jag byta mellan ljust och mörkt läge?**
Ja, under Konto → Tema kan du välja utseende.

## Support och kontakt

**Hur kontaktar jag support eller rapporterar ett problem?**
Använd feedback-knappen (pratbubblan) längst ner i sidomenyn. Är du inloggad
behöver du inte ange e-post; annars krävs en e-postadress så vi kan svara.

**Finns det en FAQ-sida?**
Ja, under Support → Vanliga frågor i profilmenyn.

---

## Uttryckligen INTE inkluderat (avstängt eller overifierat just nu)

- Notisinställningar (mail/SMS/push) — hela Notifieringar-sektionen är dold
  för riktiga användare just nu (alla flaggor av)
- Ärendehantering (formellt supportärende-formulär) — byggd och fungerande
  på riktigt, men fortfarande dold bakom en avstängd flagga tills vidare
- "Sparat" (bokmärka händelser) — medvetet avstängt, sparat till en framtida
  funktionslansering
- Radera konto / ladda ner min data (GDPR) — finns i gränssnittet men gör
  ingenting vid klick
- Att lägga till källor via adressförslag (SPAR) — borttaget
- Tvåfaktorsautentisering, aktiva sessioner — avstängt/mock
