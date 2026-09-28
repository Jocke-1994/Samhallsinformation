import { describe, expect, it } from 'vitest'
import {
  extraheraPolisenTyp, extraheraPolisenOmrade, länFörGeografi, kommunerILän, groupBy,
  POLISEN_KATEGORIER, LÄN_KOMMUNER,
} from '../components/Profile/MinaKallor/kallorUtils'

// Enhet-8 (E8, avsnitt 5, F5): dessa var listade som de föreslagna första
// frontend-testerna men fanns aldrig — hela filen (V1-0b och senare) hade noll
// test, varken direkt eller indirekt (NewsItem.tsx, som är enda konsumenten av
// extrahera*, saknar egen testfil). Testerna nedan låser fast den redan
// dokumenterade historiken i själva kallorUtils.ts: title.startsWith-buggen
// (kommentarrad 163-175) och att "Sammanfattning natt"/"...kväll och natt"
// taggas med ett helt LÄN, inte en kommun (rad 182-191).

describe('extraheraPolisenTyp', () => {
  it('null/undefined/tom sträng ger null', () => {
    expect(extraheraPolisenTyp(null)).toBeNull()
    expect(extraheraPolisenTyp(undefined)).toBeNull()
    expect(extraheraPolisenTyp('')).toBeNull()
  })

  it('en exakt kategori matchar sig själv', () => {
    expect(extraheraPolisenTyp('Trafikolycka')).toBe('Trafikolycka')
    expect(extraheraPolisenTyp('Brand')).toBe('Brand')
  })

  it('en kvalificerare efter basen matchar ändå (startsWith), som riktig Polisen-data har ("Trafikolycka, personskada")', () => {
    expect(extraheraPolisenTyp('Trafikolycka, personskada')).toBe('Trafikolycka')
    expect(extraheraPolisenTyp('Stöld, ringa')).toBe('Stöld')
  })

  it('matchar mot eventType, inte mot en titel med datumprefix — regressionstest för buggen som fanns innan PR #373/session 2026-08-19', () => {
    // Den gamla, trasiga logiken körde title.startsWith(kategori) mot en titel
    // som "14 augusti 13.05, Trafikolycka, ..." — det hade ALDRIG matchat.
    // extraheraPolisenTyp tar bara det redan strukturerade eventType-fältet,
    // så ett sådant datumprefix ska aldrig skickas in, men om det ändå gör
    // det (regression) ska det inte råka matcha av misstag.
    expect(extraheraPolisenTyp('14 augusti 13.05, Trafikolycka, Kungälv')).toBeNull()
  })

  it('en typ utanför den kuraterade listan (t.ex. "Bedrägeri", "Rattfylleri") ger null — känd, dokumenterad lucka, inte en krasch', () => {
    expect(extraheraPolisenTyp('Bedrägeri')).toBeNull()
    expect(extraheraPolisenTyp('Rattfylleri')).toBeNull()
    expect(extraheraPolisenTyp('Arbetsplatsolycka')).toBeNull()
  })

  it('"Sammanfattning kväll och natt" matchar sig själv, inte av misstag "Sammanfattning natt" (ordning i POLISEN_KATEGORIER)', () => {
    expect(extraheraPolisenTyp('Sammanfattning kväll och natt')).toBe('Sammanfattning kväll och natt')
    expect(extraheraPolisenTyp('Sammanfattning natt')).toBe('Sammanfattning natt')
  })

  it('täcker alla kuraterade kategorier (varje kategori matchar sig själv)', () => {
    for (const kat of POLISEN_KATEGORIER) {
      expect(extraheraPolisenTyp(kat)).toBe(kat)
    }
  })
})

describe('extraheraPolisenOmrade', () => {
  it('null ger null', () => {
    expect(extraheraPolisenOmrade(null)).toBeNull()
  })

  it('en riktig kommun ger tillbaka kommunen oförändrad', () => {
    expect(extraheraPolisenOmrade('Uppsala')).toBe('Uppsala')
    expect(extraheraPolisenOmrade('Kungälv')).toBe('Kungälv')
    expect(extraheraPolisenOmrade('Stenungsund')).toBe('Stenungsund')
  })

  it('en kommun med bindestreck (känd stavningsosäkerhet, E3/E5) matchar exakt eller inte alls', () => {
    expect(extraheraPolisenOmrade('Upplands-Bro')).toBe('Upplands-Bro')
    expect(extraheraPolisenOmrade('Upplands Bro')).toBeNull() // fel stavning matchar inte
  })

  it('ett helt LÄN ger null — regressionstest för buggen med Polisens sammanfattningar (rad 182-191 i kallorUtils.ts)', () => {
    // "Sammanfattning natt"/"...kväll och natt" taggas av Polisen med ett helt
    // län som Geography, aldrig en kommun. extraheraPolisenOmrade ska INTE
    // felaktigt "hitta" ett kommunnamn i den — den ska ge null (okänt område),
    // så att anroparen kan falla tillbaka på länFörGeografi i stället.
    expect(extraheraPolisenOmrade('Västra Götalands län')).toBeNull()
    expect(extraheraPolisenOmrade('Stockholms län')).toBeNull()
  })

  it('en helt okänd/påhittad plats ger null', () => {
    expect(extraheraPolisenOmrade('Narnia')).toBeNull()
  })
})

describe('länFörGeografi', () => {
  it('null ger null', () => {
    expect(länFörGeografi(null)).toBeNull()
  })

  it('ett riktigt län ges tillbaka oförändrat — täcker fallet extraheraPolisenOmrade missar', () => {
    expect(länFörGeografi('Västra Götalands län')).toBe('Västra Götalands län')
    expect(länFörGeografi('Stockholms län')).toBe('Stockholms län')
  })

  it('en kommun (fel nivå) ger null, inte en gissning på vilket län den ligger i', () => {
    expect(länFörGeografi('Uppsala')).toBeNull()
    expect(länFörGeografi('Göteborg')).toBeNull()
  })

  it('en okänd sträng ger null', () => {
    expect(länFörGeografi('Narnia')).toBeNull()
  })
})

describe('kommunerILän', () => {
  it('ett känt län ger dess kommuner (matchar LÄN_KOMMUNER exakt)', () => {
    expect(kommunerILän('Västra Götalands län')).toEqual(LÄN_KOMMUNER['Västra Götalands län'])
    expect(kommunerILän('Västra Götalands län')).toContain('Göteborg')
    expect(kommunerILän('Västra Götalands län')).toContain('Kungälv')
  })

  it('ett okänt län ger en tom lista, aldrig undefined/krasch (används av matcharLän i PolisenBevakningarContext)', () => {
    expect(kommunerILän('Ett påhittat län')).toEqual([])
  })
})

describe('groupBy', () => {
  it('grupperar element efter nyckelfunktionens returvärde och behåller ordningen inom varje grupp', () => {
    const items = [
      { id: 1, typ: 'a' },
      { id: 2, typ: 'b' },
      { id: 3, typ: 'a' },
      { id: 4, typ: 'a' },
      { id: 5, typ: 'b' },
    ]
    const grupperat = groupBy(items, i => i.typ)
    expect(Object.keys(grupperat).sort()).toEqual(['a', 'b'])
    expect(grupperat.a.map(i => i.id)).toEqual([1, 3, 4])
    expect(grupperat.b.map(i => i.id)).toEqual([2, 5])
  })

  it('en tom lista ger ett tomt objekt', () => {
    expect(groupBy<{ typ: string }>([], i => i.typ)).toEqual({})
  })
})
