---
kategori: "Konto"
status: aktiv
uppdaterad: 2026-09-13
---

# En användare hör av sig om push-notiser

Utlöses av: en användare frågar varför de inte får push-notiser, eller
ber om att en push-inställning ändras åt dem.

## Självbetjäning
Push-notiser styrs helt av användaren själv under **Konto → Push-notiser**
— global på/av samt kategorierna "Ny händelse" och "Ny version". Peka dit
först, de allra flesta ärenden löses där.

## Om det kommer in som ett supportärende
1. Bekräfta att du pratar med kontoägaren (samma regel som alltid)
2. Öppna kontot i Användarhantering → fliken **Översikt** → sektionen
   **Push-notiser**. Där ser du direkt: global på/av, båda kategorierna,
   och användarens registrerade enheter (namn/plattform/senast sedd)
3. Fråga vad de faktiskt vill ha ändrat — ändra bara det de bett om
4. Registrerade enheter syns men går inte att ta bort härifrån — om en
   gammal/död enhet är boven, be användaren logga in och slå av/på push
   en gång i Konto, det städar upp enhetslistan

## Adminverktyg / fallback
Samma Översikt-sektion har nu även **skrivrätt** (tillagt 2026-09-13) —
klicka på en badge för att slå av/på. **Använd det ENDAST när användaren
själv uttryckligen bett om ändringen** i ärendet — det är annars deras
eget val, inte något admin ska styra åt dem i förebyggande syfte.

## Teknisk plats
Läs+skriv: `GET/PUT /api/admin/users/{id}/push-settings`
(`AdminUserDetailsController`). Samma fält
(`User.PushEnabled`/`PushNyaHandelser`/`PushNyVersion`) som
självbetjäningens `PUT /api/push/settings`. Varje ändring loggas i
Inställningshistorik-fliken (`push_enabled`/`push_nya_handelser`/
`push_ny_version`), `ChangedBy = "admin"`. Se [[../../Funktioner/Push-notiser]].

## Gränser / vad du INTE ska göra
- Ändra aldrig en användares push-inställningar utan att de själva bett
  om det i ärendet — logga inte in och "fixa i förväg" bara för att något
  ser avstängt ut
- Enhetslistan (namn/plattform) är read-only här — ingen "ta bort
  enhet"-knapp finns, det är avsiktligt (enheten städas bort automatiskt
  när prenumerationen går ut, eller av användaren själv)
