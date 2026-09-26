import { describe, expect, it } from 'vitest'
import { visaFel } from '../lib/felmeddelande'

const RESERV = 'Något gick fel. Försök igen.'

describe('visaFel (V3-9)', () => {
  it('visar serverns egna svenska text', () => {
    expect(visaFel(new Error('E-postadressen används redan'), RESERV)).toBe('E-postadressen används redan')
  })

  it('byter tekniska statusfel från API-lagret mot reservtexten', () => {
    expect(visaFel(new Error('saveUserSources: 500'), RESERV)).toBe(RESERV)
    expect(visaFel(new Error('requestEmailChange: 429'), RESERV)).toBe(RESERV)
  })

  it('byter nätverksfel (TypeError från fetch) mot reservtexten', () => {
    expect(visaFel(new TypeError('Failed to fetch'), RESERV)).toBe(RESERV)
    expect(visaFel(new TypeError('Load failed'), RESERV)).toBe(RESERV)
  })

  it('byter tomma och icke-Error-värden mot reservtexten', () => {
    expect(visaFel(new Error('  '), RESERV)).toBe(RESERV)
    expect(visaFel('bara en sträng', RESERV)).toBe(RESERV)
    expect(visaFel(undefined, RESERV)).toBe(RESERV)
  })
})
