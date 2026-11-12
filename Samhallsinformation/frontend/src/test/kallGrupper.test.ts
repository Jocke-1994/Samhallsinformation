import { describe, expect, it } from 'vitest'
import { grupperaKallor, representant } from '../components/Profile/MinaKallor/kallGrupper'
import type { Source } from '../types'

function kalla(overrides: Partial<Source>): Source {
  return {
    id: 1,
    name: 'X',
    shortName: 'X',
    baseUrl: 'https://example.com',
    isActive: true,
    scope: 'nationell',
    ...overrides,
  }
}

describe('grupperaKallor', () => {
  it('källor med olika shortName hamnar i varsin grupp', () => {
    const polisen = kalla({ id: 1, name: 'Polisen', shortName: 'Polisen' })
    const smhi = kalla({ id: 2, name: 'SMHI', shortName: 'SMHI' })

    const grupper = grupperaKallor([polisen, smhi])

    expect(grupper.size).toBe(2)
    expect(grupper.get('Polisen')).toEqual([polisen])
    expect(grupper.get('SMHI')).toEqual([smhi])
  })

  it('källor med samma shortName hamnar i samma grupp, i ordningen de kom in', () => {
    const polisen = kalla({ id: 1, name: 'Polisen', shortName: 'Polisen' })
    const efterlysningar = kalla({ id: 2, name: 'Polisen Efterlysningar', shortName: 'Polisen' })

    const grupper = grupperaKallor([polisen, efterlysningar])

    expect(grupper.size).toBe(1)
    expect(grupper.get('Polisen')).toEqual([polisen, efterlysningar])
  })
})

describe('representant', () => {
  it('väljer källan vars Name exakt matchar ShortName (huvudkällan)', () => {
    const efterlysningar = kalla({ id: 2, name: 'Polisen Efterlysningar', shortName: 'Polisen' })
    const polisen = kalla({ id: 1, name: 'Polisen', shortName: 'Polisen' })

    // Ordningen i arrayen ska inte spela roll — huvudkällan vinner oavsett.
    expect(representant([efterlysningar, polisen])).toBe(polisen)
    expect(representant([polisen, efterlysningar])).toBe(polisen)
  })

  it('faller tillbaka på första källan om ingen Name matchar ShortName exakt', () => {
    const a = kalla({ id: 1, name: 'Nyheter A', shortName: 'X' })
    const b = kalla({ id: 2, name: 'Nyheter B', shortName: 'X' })

    expect(representant([a, b])).toBe(a)
  })

  it('en ensam källa representerar sig själv', () => {
    const krisinformation = kalla({ id: 1, name: 'Krisinformation', shortName: 'Krisinformation' })

    expect(representant([krisinformation])).toBe(krisinformation)
  })
})
