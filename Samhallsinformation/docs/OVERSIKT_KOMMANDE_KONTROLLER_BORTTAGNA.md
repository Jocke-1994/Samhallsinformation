# Kommande kontroller — borttagna jobbtyper (Admin → Översikt)

Sparat 2026-07-30 i samband med V1-scope-genomgången. "Kommande kontroller"-kortet
på admin-startsidan (`components/Admin/Oversikt.tsx`) visade tre jobbtyper. Bara en
av dem motsvarar något som faktiskt körs i backend — de andra två beskrev jobb som
aldrig byggts. De togs bort ur UI:t (inte bara mockad data — hela konceptet finns
inte), men bedöms troligen byggas på riktigt någon gång, så hela specen sparas här.

## Vad som finns kvar (riktigt)

`IngestorBackgroundService` (backend) kör **alla aktiva källor** var 5:e minut,
en enda gemensam periodisk körning (`TimeSpan.FromMinutes(5)`, se
`Services/IngestorBackgroundService.cs`). Ingen per-källa-frekvens, inget kösystem.
Kortet visar nu bara den här raden, med statisk beskrivande text ("Körs var 5:e
minut") istället för en påhittad nedräkningsklocka — det finns ingen endpoint som
exponerar exakt nästa körningstid, så en exakt countdown hade varit lika påhittad
som det som togs bort.

## Borttaget: "Event-drivet"

**Idé:** vissa källor (ursprungligen Polisen och Trafikverket nämnda som exempel)
skulle kunna hämtas **händelsestyrt** istället för på den gemensamma 5-minuterstakten
— t.ex. en webhook, en kortare pollningsintervall för högfrekventa/tidskritiska
källor, eller en riktig kö där väntande hämtningar syns ("2 i kö").

**Varför det inte finns idag:** `IngestorBackgroundService` har bara EN enhetlig
timer för alla källor. Ingen per-källa-konfiguration av frekvens, inget kösystem,
ingen webhook-mottagare.

**Vad som krävs för att bygga det på riktigt:**
- Ett sätt att markera enskilda källor som "händelsestyrda" (t.ex. ett fält på
  `Source`-modellen, `FetchStrategy: Periodic | EventDriven`)
- Antingen en kortare per-källa-timer, eller en riktig webhook/push-mekanism om
  källan stödjer det (varken Polisen eller Trafikverket exponerar webhooks idag,
  så i praktiken skulle det bli en tätare polling snarare än riktig event-styrning
  till att börja med)
- En kö-modell om flera händelsestyrda körningar kan krocka (för att visa en
  ärlig "X i kö"-siffra, inte en påhittad)

## Borttaget: "Fullständigt flödestest"

**Idé:** ett nattligt jobb (kortet visade 04:00) som kör igenom **hela pipelinen**
för alla aktiva källor som ett hälsotest — inte för att hämta nya händelser, utan
för att upptäcka trasiga ingestors/källor proaktivt innan en admin eller användare
märker det. Ett komplement till den vanliga 5-minuterskörningen, med fokus på att
verifiera att allt fortfarande fungerar snarare än att bara samla in data.

**Varför det inte finns idag:** inget separat/schemalagt hälsotestjobb existerar i
backend. Den vanliga ingestorn upptäcker fel (`LastFetchError`) som en bieffekt av
sin normala körning, men det finns ingen dedikerad, oberoende testkörning.

**Vad som krävs för att bygga det på riktigt:**
- Ett separat schemalagt jobb (ny `BackgroundService` eller en tidsstyrd gren i den
  befintliga), skilt från den vanliga insamlingen
- Ett sätt att skilja "detta var ett hälsotest" från "detta var en riktig
  datainsamling" i loggar/`LastFetchedAt`, så testkörningar inte förväxlas med
  riktig färskhet i Källhantering/Källstatus
- Troligen en notifiering till admin (e-post/push, kopplat till Push-notiser-arbetet,
  se `project_uppdateringar_schemalagd_publicering_spec`-minnet) om testet hittar
  ett fel, annars är poängen med att köra det proaktivt förlorad

## Sammanfattning

| Jobbtyp | Status idag | Krävs för att bygga |
|---|---|---|
| Ingestor (alla aktiva källor, var 5:e min) | **Byggd, riktig** | — |
| Event-drivet (per-källa-frekvens/kö) | Inte byggd | Fetch-strategifält på Source, ev. tätare timer eller webhook, kömodell |
| Fullständigt flödestest (nattligt hälsotest) | Inte byggd | Separat schemalagt jobb, egen loggning, notis vid fel |
