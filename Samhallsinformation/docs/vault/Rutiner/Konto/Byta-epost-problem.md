---
kategori: "Konto"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare har problem med att byta e-postadress

Utlöses av: "jag bytte e-post men fick ingen bekräftelselänk", "jag
råkade skriva fel ny adress", "jag vill avbryta ett pågående byte".

## Självbetjäning
Byte sker under **Konto → Kontouppgifter**. Sedan session 41 (PR #503,
branschstandard-ombyggnad):
1. Kontots faktiska e-post ändras INTE förrän en bekräftelselänk skickad
   till den NYA adressen klickas — kontot fungerar som vanligt med den
   gamla adressen tills dess
2. Ett varningsmejl går samtidigt till den GAMLA adressen
3. Ett lyckat byte loggar ut alla sessioner (måste logga in igen)
4. Skrev de fel ny adress, eller ångrar sig innan länken klickats: en
   **"Avbryt"**-knapp syns i väntande-bekräftelse-bannern på
   Kontouppgifter-kortet

## Om det kommer in som ett supportärende
1. "Ingen bekräftelselänk kom" — be dem kolla skräpposten på den NYA
   adressen (inte gamla) först. Länken är giltig i 24 timmar
2. "Jag skrev fel ny adress" — de kan avbryta själva (se ovan) om de
   fortfarande är inloggade med gamla adressen. Om de loggat ut och
   inte kommer åt kontot — se [[Kan-inte-logga-in]]
3. Lösenordskonton kräver nuvarande lösenord för att ens STARTA ett
   byte — om de inte minns lösenordet, lös det via
   [[Losenordsaterstallning]] först

## Adminverktyg / fallback
Finns inte — inget admin-endpoint för att tvinga fram eller avbryta ett
e-postbyte åt en användare. Det är ett medvetet säkerhetsval (samma
resonemang som att inte kunna sätta ett nytt lösenord manuellt, se
[[Kan-inte-logga-in]]).

## Teknisk plats
`POST /api/auth/me/email-change` (begär), `DELETE /api/auth/me/email-change`
(avbryt pågående), `POST /api/auth/confirm-email-change` (bekräfta via
länk). Se [[../../Funktioner/Kontouppgifter]].

## Gränser / vad du INTE ska göra
- Byt aldrig en användares e-post manuellt i databasen på deras begäran
  via support — hela poängen med bekräftelselänken är att bevisa
  ägarskap av den nya adressen, en manuell ändring kringgår det skyddet
