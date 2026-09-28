---
typ: beslut
status: öppen
datum: 2026-09-25
---

# Beslut - GDPR-omfång vid kontoradering

**Byggt och live, men besluten nedan togs av Claude (PM) på delegation medan du var borta — bekräfta eller ändra dem.**
Åtgärd: när en raderingsbegäran löper ut (24 h efter begäran, ångra-länken är orörd) anonymiseras nu **all** persondata om användaren, inte bara själva konto-raden. Tidigare låg t.ex. namn och e-post kvar i loggar, ärenden och push-loggar (fynd E3#9 i [[Code-review 2026-09-25]], PR "GDPR-anonymisering fullständig" = V2-14 i åtgärdsplanen).

## Vad som RADERAS helt (användarens egna val och tekniska nycklar)
Push-enheter/prenumerationer, refresh-tokens, lösenordsåterställnings-/verifierings-/e-postbytestokens, sparade händelser, källpreferenser, notisinställningar och stör-ej-scheman, Polisen-bevakningar, push-claims, idé-testare, gamla preferenser.

## Vad som ANONYMISERAS (raden behålls, identifierare tas bort)
- **Supportärenden:** kontaktnamn blir "Raderad användare", e-post blir `deleted-{id}@anonymized.local`. Meddelandetext behålls (supporthistorik), men förekomster av användarens namn/e-post byts mot `[borttagen]`.
- **Notisleveranslogg:** rader behålls; mottagare (push-endpoint) och text med namn/e-post scrubbas (t.ex. "ny användare"-notiserna som gick till admin).
- **Aktivitetslogg och inställningshistorik:** rader behålls för spårbarhet, `UserId` blir pseudonym, namn/e-post i texten byts mot `[borttagen]`. IP och enhet nollas för användaren själv och för System-händelser om användaren.
- **Delningslogg:** `UserId` sätts till tomt. **Idéer/checklistor:** e-post scrubbas.
- Ej utförda schemalagda supportåtgärder i användarens ärenden raderas (de kan aldrig levereras).

## Vad som BEHÅLLS
Rena användar-ID-referenser (vem som skapade/tilldelades något) och `TermsAcceptedAt`, `SuspendedAt`, `AuthProvider`, `CreatedAt`. Inga namn eller e-post.

## Beslut att bekräfta
1. Loggar **behålls** med pseudonymt ID (alternativ: radera raderna helt).
2. Supportärenden och meddelandetext **behålls** anonymiserade (alternativ: radera hela ärenden — förlorar supporthistorik).
3. `NotificationDeliveryLog`-rader behålls med scrubbad text (alternativ: radera).
4. Kända begränsningar: konton som anonymiserades **före** den här ändringen har kvar gammal persondata i sidotabellerna (kan rensas med ett engångsjobb om du vill); fritext med andra personuppgifter än registrerat namn/e-post (telefonnummer, smeknamn) rensas inte.

## Kopplat
- [[Code-review 2026-09-25]] · [[Radera-konto]]
