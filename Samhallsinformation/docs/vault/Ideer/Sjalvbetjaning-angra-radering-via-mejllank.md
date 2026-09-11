---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Ingen teknisk blockerare — samma mönster som PasswordResetToken/EmailChangeToken finns redan i kodbasen. Väntar på att fler kopplade frågor (se Öppna frågor) reds ut innan den byggs."
prioritet: ej-bedomd
pipelineNr: ""
kalla: "Rutiner-genomgång, session 2026-09-11"
---

# Självbetjäning: ångra radering via mejllänk

Just nu finns INGEN notifiering alls när en radering begärs (varken
självbetjäning eller admin) — bekräftat i koden, `AuthController.DeleteMe`
och `AdminUsersController.Delete` skickar inget mejl. Användaren märker
bara att kontot är borta när de försöker logga in.

## Förslaget
1. I samma ögonblick en radering begärs → skicka automatiskt ett mejl:
   "Ditt konto raderas om 24 timmar om du inte avbryter" + en
   **ångra-länk** med en unik, engångs-token (samma mönster som
   `PasswordResetToken`/`EmailChangeToken`)
2. Klick på länken → ett nytt, öppet endpoint (ingen inloggning krävs —
   token:et ÄR beviset på identitet) → nollar `DeletionScheduledAt`,
   återaktiverar kontot direkt
3. Ingen support-inblandning behövs i normalfallet — [[../Rutiner/Konto/Angra-radering|Rutinen]]s
   manuella adminväg blir bara en fallback för när mejlet inte går fram

Löser två problem samtidigt: (1) användaren får äntligen VETA att en
radering är på gång, (2) de kan ångra sig själva utan att kontakta
support alls.

## Öppna frågor
- Ska mejlet skickas ÄVEN när admin initierar raderingen (t.ex. vid
  missbruk) — eller bara vid självbetjäning? En admin-initierad radering
  kanske inte ska ge kontoinnehavaren en enkel väg att ångra den själv
- Övervägdes: en 6-siffrig kod istället för en länk, som identitetsbevis
  när användaren kontaktar support manuellt. Bedömdes svagare än en länk
  (kräver att support manuellt matchar koden mot rätt konto, löser inte
  "användaren vet inte att kontot ska raderas"-problemet)
- Räcker det med EN länk, eller ska det finnas en påminnelse t.ex. 2h
  innan de 24 timmarna går ut, för den som missar det första mejlet?

## Kopplat
- [[../Rutiner/Konto/Angra-radering]] — nuvarande manuella rutin, blir
  fallback-vägen om det här byggs
- [[../Funktioner/GDPR-verktyg]]
