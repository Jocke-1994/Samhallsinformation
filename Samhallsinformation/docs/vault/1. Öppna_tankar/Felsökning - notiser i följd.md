---
typ: felsökning
status: väntar på återkoppling
---

# Felsökning: notiser som kommer en i taget

**Bakgrund:** en användare på Discord fick ungefär 10 notiser i rad när datorn
startade (2026-11-14). Det åtgärdades i PR #745: pushar från samma källa slås
ihop till en notis med summerat antal. Användaren har lovat att hålla koll.
Använd listan nedan om det fortfarande inte fungerar.

**Så ska det fungera:** en notis per källa ("68 nya händelser från
Trafikverket"). Det plingar en gång, sedan räknas antalet upp tyst. Olika
källor ger fortfarande en notis var, och det är rätt.

## 1. Fråga användaren

- [ ] Vilken enhet och webbläsare? (Windows + Chrome/Edge, Android, iPhone med appen installerad)
- [ ] Ungefär när? (datum och klockslag när datorn eller telefonen startade)
- [ ] Hur många notiser, och från **vilka källor**?
- [ ] Var det flera notiser från **samma** källa, eller en per källa? (en per källa = fungerar som det ska)
- [ ] Har hen öppnat sajten sedan 14 nov? (den nya service workern laddas först då)
- [ ] Skärmdump på notiscentret om möjligt

## 2. Kolla själva

- [ ] **Frontend i produktion:** `https://samhallsinformation.se/sw.js` innehåller `importScripts('/sw-notisgrupp.js')` och `/sw-notisgrupp.js` svarar med 200 och JavaScript (verifierat 2026-11-14)
- [ ] **Backend i produktion:** Railway kör en version från commit `139e8d2` eller senare. Annars skickas inget `grupp`-fält och varje push blir en egen notis som förut
- [ ] **Pushloggen** (Admin → Felsökning, `GET /api/push/logs`): hur många pushar gick till användaren under perioden, från vilka källor och med vilken status? Många pushar per källa är väntat (en per ingestor-körning var 5:e minut). Felet är om de inte slogs ihop på enheten
- [ ] **Service workern på en egen enhet:** Chrome → DevTools → Application → Service Workers. Är den aktiva versionen den nya? Finns fel i SW-konsolen (`sw-notisgrupp.js` saknas, `byggGrupperadNotis is not a function`)?
- [ ] **Återskapa själv:** ha en egen enhet avstängd eller i flygplansläge i 30–60 minuter med en livlig källa (Trafikverket) i Mitt flöde, och slå sedan på den. Förväntat resultat: en notis med summerat antal

## 3. Kända begränsningar

- **Pushloggen visar inte `grupp`-fältet**, bara titel och text. Om det inte går att se om backend skickade med det kan vi behöva logga det
- **Olika enheter:** varje enhet slår ihop sina egna notiser. Claim-logiken gör ändå att en push bara visas på en av användarens enheter
- **iPhone (Safari):** stödet för `tag`/`renotify` är sämre än i Chrome. Fel där kan vara webbläsarens begränsning snarare än vår kod
- **En gammal notis ligger kvar:** summan fortsätter räknas upp på den notis som redan visas tills användaren stänger den. Det är medvetet

## 4. Om det fortfarande inte fungerar

- **`Topic`-header per källa i backend** (`WebPushNotificationService`): pushtjänsten behåller då bara den senaste väntande pushen per källa, så floden stoppas redan innan den når enheten. Nackdel: antalet i notisen blir bara det senaste, inte summan
- **Kortare TTL** än 24 timmar (`PushTtlSeconds`), så att gamla pushar inte levereras alls efter en längre tids frånvaro
- **Logga `grupp.tag` i `NotificationDeliveryLog`** så att det syns i efterhand vad som skickades
