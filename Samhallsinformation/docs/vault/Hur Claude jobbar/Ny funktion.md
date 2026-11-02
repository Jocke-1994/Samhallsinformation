---
typ: claude-flode
status: ritad, ej verifierad
---

# Ny funktion

Variant av [[0. Grundflödet]]. Här är alla steg stora, eftersom något helt nytt ska in i ett hus som redan står.

```mermaid
flowchart TD
    A["Du: bygg funktion X"] --> B["Kolla valvet och minnet:<br/>finns idén beskriven?<br/>Finns beslut redan fattade?"]
    B --> C{"Är beteendet bestämt?<br/>(vad händer när man klickar,<br/>vem får se det)"}
    C -- "Nej" --> D["Fråga dig, ev. visa en skiss först"]
    D --> C
    C -- "Ja" --> E["Hitta en LIKNANDE funktion<br/>som redan finns"]
    E --> F["Följ den genom huset:<br/>skärm → server → databas"]
    F --> G["Nu vet jag vilka filer som behövs<br/>och vilket mönster jag ska följa"]
    G --> H{"Hur stor är den?"}
    H -- "Flera delar som<br/>kan släppas var för sig" --> I["Dela upp: en PR per del"]
    H -- "Liten" --> J["En PR"]
    I --> K
    J --> K{"Ska den kunna slås<br/>av/på i efterhand?"}
    K -- "Ja" --> L["Lägg den bakom en flagga"]
    K -- "Nej" --> M
    L --> M["Bygg inifrån och ut:<br/>databas → server → skärm"]
    M --> N["Kontrollera:<br/>se Välja tester"]
    N --> O{"Grönt?"}
    O -- "Nej" --> P["Felsök"] --> M
    O -- "Ja" --> Q["Ny gren, PR, berätta för dig"]
    Q --> R["Uppdatera valvet:<br/>funktionen finns nu"]
```

## Med enkla ord

- **Hitta en liknande funktion.** Det viktigaste steget. Ska jag bygga ett nytt rum tittar jag först på hur de andra rummen är byggda, så det nya ser ut som resten av huset. Jag läser inte alla filer, bara de som hör till "grannfunktionen".
- **Följ den genom huset.** En funktion går oftast genom tre våningar: det du ser (skärmen), det som tar emot och bestämmer (servern) och det som minns (databasen). Följer jag grannfunktionen genom alla tre vet jag vilka filer jag behöver.
- **När har jag läst tillräckligt?** När jag kan säga "jag ska ändra de här filerna, på det här sättet, och det här kommer inte påverkas". Kan jag inte säga det läser jag mer.
- **En PR per del.** Hellre tre små paket som kan granskas och ångras var för sig än ett jättepaket.
- **Inifrån och ut.** Grunden först, sedan väggarna, sist tapeten. Då finns det alltid något att stå på.

← [[0. Grundflödet]] · [[Välja tester]] · [[_Start|Hur Claude jobbar]]
