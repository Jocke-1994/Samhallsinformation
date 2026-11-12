import { describe, expect, it } from 'vitest'
import { provaSjalvLänk } from '../lib/provaSjalv'

// Regler från idén (Ideer/Prova-sjalv-lankar.md, beslut 2026-11-02):
// länken följer funktionens flagga, besökare ser "kräver konto" och går via
// inloggningen, och en länk till sidan man redan står på visas inte.

const allaPå = {
  flode_platsfilter: true,
  uppdateringar_senaste: true,
  notif_push: true,
  flode_sparat: true,
}

describe('provaSjalvLänk', () => {
  it('leder direkt dit när funktionen är på och inget konto krävs', () => {
    expect(provaSjalvLänk('senaste-nytt-plats', { inloggad: false, flaggor: allaPå })).toEqual({
      href: '/?vy=plats',
      kräverKonto: false,
    })
  })

  it('besökare går via inloggningen och får veta att det kräver konto', () => {
    expect(provaSjalvLänk('konto-push', { inloggad: false, flaggor: allaPå })).toEqual({
      href: '/login?redirect=%2Fprofil%3Fsection%3Dkonto',
      kräverKonto: true,
    })
  })

  it('inloggade går direkt, utan konto-märkning', () => {
    expect(provaSjalvLänk('konto-push', { inloggad: true, flaggor: allaPå })).toEqual({
      href: '/profil?section=konto',
      kräverKonto: false,
    })
  })

  it('ingen länk när funktionens flagga är av', () => {
    expect(
      provaSjalvLänk('senaste-nytt-plats', {
        inloggad: true,
        flaggor: { ...allaPå, flode_platsfilter: false },
      }),
    ).toBeNull()
    expect(provaSjalvLänk('mitt-flode-sparat', { inloggad: true, flaggor: {} })).toBeNull()
  })

  it('mål utan flagga (Mina källor, Support) visas alltid', () => {
    expect(provaSjalvLänk('support', { inloggad: true, flaggor: {} })).toEqual({
      href: '/profil?section=support',
      kräverKonto: false,
    })
  })

  it('ingen länk till sidan man redan står på', () => {
    expect(
      provaSjalvLänk('profil-uppdateringar', {
        inloggad: true,
        flaggor: allaPå,
        härifrån: 'profil-uppdateringar',
      }),
    ).toBeNull()
  })

  it('okänt, tomt eller saknat mål ger ingen länk', () => {
    expect(provaSjalvLänk('https://evil.se', { inloggad: true, flaggor: allaPå })).toBeNull()
    expect(provaSjalvLänk('toString', { inloggad: true, flaggor: allaPå })).toBeNull()
    expect(provaSjalvLänk(null, { inloggad: true, flaggor: allaPå })).toBeNull()
    expect(provaSjalvLänk(undefined, { inloggad: true, flaggor: allaPå })).toBeNull()
  })
})
