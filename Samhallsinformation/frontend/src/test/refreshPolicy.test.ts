import { describe, expect, it } from 'vitest'
import {
  MIN_REFRESH_FORDROJNING_MS,
  RETRY_TAK_MS,
  beraknaRefreshFordrojning,
  beraknaRetryFordrojning,
  beslutaAtgardVidFel,
} from '../lib/refreshPolicy'

describe('beslutaAtgardVidFel', () => {
  it.each([401, 403])('loggar ut vid %i (servern avvisar token)', status => {
    expect(beslutaAtgardVidFel(status)).toBe('loggaUt')
  })

  it.each([400, 408, 429, 500, 502, 503, 504])('försöker igen vid %i', status => {
    expect(beslutaAtgardVidFel(status)).toBe('forsokIgen')
  })

  it('försöker igen vid nätverksfel (null)', () => {
    expect(beslutaAtgardVidFel(null)).toBe('forsokIgen')
  })
})

describe('beraknaRetryFordrojning', () => {
  it('dubblar per försök och kapas vid taket', () => {
    expect(beraknaRetryFordrojning(1)).toBe(10_000)
    expect(beraknaRetryFordrojning(2)).toBe(20_000)
    expect(beraknaRetryFordrojning(3)).toBe(40_000)
    expect(beraknaRetryFordrojning(10)).toBe(RETRY_TAK_MS)
  })

  it('respekterar Retry-After när den är längre än backoff, men kapar den', () => {
    expect(beraknaRetryFordrojning(1, '45')).toBe(45_000)
    expect(beraknaRetryFordrojning(3, '5')).toBe(40_000)
    expect(beraknaRetryFordrojning(1, '86400')).toBe(RETRY_TAK_MS)
  })

  it('ignorerar en Retry-After som inte är ett heltal (t.ex. HTTP-datum)', () => {
    expect(beraknaRetryFordrojning(2, 'Wed, 21 Oct 2026 07:28:00 GMT')).toBe(20_000)
  })
})

describe('beraknaRefreshFordrojning', () => {
  const NU = 1_000_000_000_000
  const MIN = 60_000

  it('refreshar 2 min före utgång för en normal token', () => {
    expect(beraknaRefreshFordrojning(NU + 15 * MIN, NU)).toBe(13 * MIN)
  })

  it('aldrig under golvet, även när token redan ser utgången ut (klockskillnad)', () => {
    expect(beraknaRefreshFordrojning(NU + MIN, NU)).toBe(MIN_REFRESH_FORDROJNING_MS)
    expect(beraknaRefreshFordrojning(NU - 5 * MIN, NU)).toBe(MIN_REFRESH_FORDROJNING_MS)
  })

  it('kapas av token-livslängden när iat finns (klockan går efter)', () => {
    // Färsk 15-min-token men klientklockan 10 min efter: absolut väntetid vore 23 min.
    const exp = NU + 25 * MIN
    expect(beraknaRefreshFordrojning(exp, NU, exp - 15 * MIN)).toBe(13 * MIN)
  })
})
