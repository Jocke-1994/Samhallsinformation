# Samhällsinformation — Roadmap

> Uppdateras löpande. Sprintar är ungefärliga — prioritera utifrån vad som ger flest användare.

---

## Mål

**Kortsiktigt:** Fler aktiva användare genom fler, bättre källor.
**Långsiktigt:** Den självklara platsen att kolla samhällsinformation i Sverige.

---

## Nuläge (Sprint 3 — klar)

- [x] App live på `samhallsinformation.se` + `www.samhallsinformation.se`
- [x] Backend på Railway EU West, PostgreSQL stabil (ingen dataförlust vid redeploy)
- [x] Källor: Polisen, Krisinformation
- [x] GA4 med intern trafikfiltrering + schemalagda vecko-/månadsrapporter
- [x] Om-sidan (`/om`)
- [x] Feedback-modal (Formspree)
- [x] Sidebar med pill-knappar för Om + Feedback

---

## Sprint 4 — SEO + Fler källor

**Mål:** Synas på Google. Fler anledningar att besöka sajten.

### SEO
- [ ] `<title>` och `<meta description>` per sida/källa
- [ ] Open Graph-taggar (för delning i sociala medier)
- [ ] `sitemap.xml` + `robots.txt`
- [ ] Verifiera i Google Search Console

### Fler källor
- [ ] MSB (Myndigheten för samhällsskydd och beredskap)
- [ ] SMHI (vädervarningar)
- [ ] 

> Tips: varje ny källa = ny ingestor-klass, inga genvägar

---

## Sprint 5 — Auth + Notifieringar

**Mål:** Ge användare en anledning att skapa konto.

### Backend-auth
- [ ] Koppla AuthContext mot riktig backend (JWT eller sessions)
- [ ] Registrering / inloggning för riktiga användare
- [ ] Spara inställningar per konto (valda källor etc.)

### Notifieringar
- [ ] Push-notifieringar (Web Push API)
- [ ] Val av vilka källor man vill ha notiser från
- [ ] 

---

## Sprint 6 — Tillväxt + Fler källtyper

**Mål:** Bredda vad tjänsten täcker, börja mäta retention.

### Fler källtyper
- [ ] Lokala nyheter / kommuner?
- [ ] SVT / SR nyhetsflöden?
- [ ] 

### Tillväxt
- [ ] Kontaktsektion på Om-sidan (info@samhallsinformation.se via Zoho Mail)
- [ ] Dela-knapp per nyhet
- [ ] 

---

## Parkerade idéer (ännu ej sprintade)

- Zoho Mail (`info@samhallsinformation.se`)
- Mörkläge som default (system preference)
- Sökfunktion i nyhetsflödet
- Filtrera på region / kommun
- Admin-verktyg: aktivera/inaktivera källor i UI utan redeploy

---

## Tekniska skulder

| Skuld | Status |
|---|---|
| GA4 schemalagda rapporter går till Gmail, inte Hotmail | Accepterat — GA4 kräver Google-konto |
| Zoho Mail ej uppsatt | Parkerad |
| Backend-auth är fortfarande hårdkodad/mockad | Sprint 5 |
