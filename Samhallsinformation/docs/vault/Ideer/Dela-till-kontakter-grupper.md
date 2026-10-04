---
typ: ide
status: ide  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd
beroenden: "[[Dela händelse]] — enklare v1 redan byggd, det här är ett medvetet senare lager ovanpå"
prioritet: ej-bedomd
pipelineNr: ""
kalla: "mejldialog med extern testare, session 38 (2026-08-22)"
---

# Dela till sparade kontakter/grupper (virality-feature)

En extern testare som provat sajten föreslog, och användaren gillade
idén: dela en händelse med ETT knapptryck till sparade telefonnummer
(familj/vänner) eller sociala grupper INOM appen — med en länk tillbaka
till sajten. Tanken är word-of-mouth-driven tillväxt som komplement till
den nuvarande SEO-drivna linjära tillväxten.

Det här är INTE samma sak som den redan byggda [[Dela händelse]]
(OS:ets delningsmeny, `navigator.share()`) — det kräver ett eget socialt
lager (sparade kontakter/grupper inom appen), inte bara en knapp till
enhetens befintliga delningsfunktioner.

## Beslut 2026-08-22 (från mejldialogen)
Definitivt vill bygga, men medvetet SENARE. Användaren hade redan då en
egen idé om HUR det skulle fungera, inte delad i den dialogen. Vänta på
att han tar upp det igen innan arbete påbörjas.

## Beslut 2026-10-04
Bekräftat återigen: [[Dela händelse]]s enkla v1 (OS-delningsmeny) är ett
medvetet första steg, det här lagret kan byggas ovanpå senare — inte en
separat, obesläktad idé. Fortfarande inte påbörjat, fortfarande väntar
på att användaren delar sin egen idé om hur det ska fungera.

## Öppna frågor
- Hur ska "sparade kontakter/grupper" se ut tekniskt? Telefonnummer
  (SMS-baserat), e-post, eller ett rent internt användar-till-användare-
  system (kräver att mottagaren redan har ett konto)?
- Användaren nämnde en egen idé om hur det borde fungera (2026-08-22,
  aldrig delad) — fråga igen när ämnet tas upp.

## Kopplat
- [[Dela händelse]] — den enklare, redan byggda v1
- Ursprunget till idén finns även i minnessystemet
  (`project_extern_feedback_maildialog_2026-08`), som täcker en bredare
  mejldialog (monetisering, SPAR, mailnotiser m.m.) — den här noten är
  bara utdraget som rör delning/virality
