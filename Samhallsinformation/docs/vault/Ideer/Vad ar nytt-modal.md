---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Ingen schemalagd publicering krävs — byggs som en kryssruta på dagens manuella changelog-redigering (nu databas-backad sedan 2026-09-15, PR #582/#583 — det gamla blockerande problemet med föråldrat Uppdateringar-innehåll är löst)."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: "#6"
kalla: "session 30"
---

# Vad är nytt-modal

En Discord-liknande modal som poppar upp automatiskt vid ny release och
visar vad som är nytt, istället för att man själv måste leta upp
Uppdateringar-sidan.

## Öppna frågor — besvarade
- **Trigga vid varje release, eller bara stora?** Tanken är varje release,
  men kan ändras senare.
- **Djuplänk till den nya funktionen?** Trevligt om möjligt, inget krav om
  det blir för omständigt.
- **Kräver schemalagd publicering, eller går det mot dagens manuella
  redigering?** Byggs mot dagens manuella — en kryssruta vid inplanering av
  en uppdatering avgör om den ska visas som "Vad är nytt".

Inga öppna frågor kvar — redo att skrivas in i adminpanelens riktiga
idé-pipeline.

## Kopplat
- [[uppdateringar]] — gruppen den hör till
