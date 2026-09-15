---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Ingen kod krävs — PWABuilder paketerar dagens PWA rakt av för Android. Kräver assetlinks.json i .well-known/ och Lighthouse-poäng ≥ 80."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: "#3"
kalla: "session 2026-08-27, uppföljning efter push-notis-diagnos för admin"
---

# Riktig app (Play Store / App Store)

Idé: ta webbappen (redan en installerbar PWA med service worker, manifest,
och Web Push) till en "riktig app" — en app store-notering, inte bara
"Lägg till på hemskärmen".

**Beslut (2026-08-27): bara Android, via PWABuilder. iOS medvetet bortvalt
tills vidare** — se besvarade frågor nedan.

## Research (2026-08-27)

Tre vägar, väldigt olika kostnad:

- **Android — billigt.** [PWABuilder](https://blog.pwabuilder.com/docs/android-platform/)
  (Googles eget verktyg, via Bubblewrap) paketerar den redan befintliga PWA:n
  som en Trusted Web Activity, som Google [själva räknar som en giltig
  Play Store-app](https://developers.google.com/codelabs/pwa-in-play).
  Ingen kodändring krävs — manifest, HTTPS och service worker finns redan.
  Kräver `assetlinks.json` i `.well-known/` för domänverifiering och
  Lighthouse-poäng ≥ 80.

- **iOS — fällan.** En ren webview-wrapper (PWABuilders iOS-output, eller
  Capacitor utan några native-funktioner) [avslås rutinmässigt av Apple
  under Guideline 4.2](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
  — "wrapping a web app is almost a guarantee of rejection" som det ser ut
  2026. För att gå igenom krävs riktig native-funktionalitet utöver själva
  webbplatsen (native push, share sheet, haptik, etc.), vilket i praktiken
  betyder [Capacitor](https://capgo.app/blog/transform-pwa-to-native-app-with-capacitor/)
  (behåller nästan all React-kod, ger riktig native-plugin-åtkomst) — ett
  riktigt utvecklingsjobb, inte en bock i en ruta.

- **Fullständig native-omskrivning** (React Native/Expo) — övervägdes inte
  vidare. Mest jobb, och det mesta av det jobbiga (installerbarhet, Web
  Push) är redan löst av den befintliga PWA-grunden.

**Viktig nyans:** iOS-användare får redan push idag via "Lägg till på
hemskärmen" (iOS 16.4+ stödjer Web Push för installerade PWA:er — se
[[Push-notiser]]). En App Store-notering på iOS ger alltså i praktiken
**upptäckbarhet**, inte ny funktionalitet användarna saknar idag.

## Öppna frågor — besvarade
- **Är App Store-upptäckbarhet ett mål i sig, eller räcker "känns som en
  riktig app"?** Räcker att det känns som en riktig app.
- **Bara Android, eller även iOS?** Android räcker just nu.
- **Vilka native-funktioner krävs för iOS/Guideline 4.2?** Inte aktuellt —
  iOS medvetet bortvalt tills vidare ("fuck iOS" — kan tas upp igen senare
  om läget ändras).

Inga öppna frågor kvar — redo att skrivas in i adminpanelens riktiga
idé-pipeline. Scope: Android via PWABuilder, ingen iOS.

## Kopplat
- [[Push-notiser]] — Web Push-grunden som redan finns, och varför iOS
  redan täcks delvis av installerbar-PWA
