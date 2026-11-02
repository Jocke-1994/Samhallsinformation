import { describe, expect, it } from 'vitest'
import {
  banderoll, checklista, formateraDag, punkterNyhetersidan, punkterProfilen, punkterVadÄrNytt, push,
  type FörhandsData,
} from '../lib/uppdateringForhandsvisning'

// Förhandsvisningen är bara värd något om den visar EXAKT det backend gör.
// Förväntade texter här är kopierade från ScheduledReleaseBackgroundService.cs,
// PushDispatcher.DispatchNewVersionAsync och UppdateringarController.MedAnnonseringsteaser.

function data(över: Partial<FörhandsData> = {}): FörhandsData {
  return {
    titel: 'Filtrera på plats', datum: '2026-11-15',
    punkter: [
      { typ: 'ny-funktion', plats: 'Senaste nytt', text: 'Filtrera på kommun', synlighet: 'alla' },
      { typ: 'ny-funktion', plats: 'Konto', text: 'Sparas på kontot', synlighet: 'inloggade' },
    ],
    schemalagd: true, schemaDatum: '2026-11-15T08:00', annonsera: false, annonseDatum: '2026-11-10T08:00',
    skickaPush: true, pushVersion: '0.9.0', pushMeddelande: 'Nu kan du filtrera', pushSkickaVid: 'Lansering',
    visaBanderoll: true, visaVadArNytt: true, valdaFlaggor: ['flode_platsfilter'], kopplatFaq: [],
    profilUppdateringarPå: true,
    ...över,
  }
}

describe('formateraDag', () => {
  it('ger "15 november" som SvenskDatum.FormateraDag', () => {
    expect(formateraDag('2026-11-15T08:00')).toBe('15 november')
  })
})

describe('Nyheter-sidan', () => {
  it('visar bara "alla"-punkter, även för inloggade', () => {
    expect(punkterNyhetersidan(data(), 'lansering').map(p => p.text)).toEqual(['Filtrera på kommun'])
  })

  it('visar "Släpps X"-teasern under annonseringen', () => {
    const ps = punkterNyhetersidan(data({ annonsera: true }), 'annonsering')
    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({ typ: 'kommer-snart', text: 'Släpps 15 november' })
  })

  it('hoppar över rader utan text', () => {
    const d = data({ punkter: [{ typ: 'buggfix', plats: 'Allmänt', text: '  ', synlighet: 'alla' }] })
    expect(punkterNyhetersidan(d, 'lansering')).toEqual([])
  })
})

describe('Profil → Uppdateringar', () => {
  it('visar alla ifyllda punkter, även "Endast inloggade"', () => {
    expect(punkterProfilen(data(), 'lansering').map(p => p.text)).toEqual(['Filtrera på kommun', 'Sparas på kontot'])
  })

  it('visar samma "Släpps X"-teaser som Nyheter-sidan under annonseringen', () => {
    const ps = punkterProfilen(data({ annonsera: true }), 'annonsering')
    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({ typ: 'kommer-snart', text: 'Släpps 15 november' })
  })
})

describe('Vad är nytt', () => {
  it('visar alla ifyllda punkter (inloggade ser även "inloggade")', () => {
    expect(punkterVadÄrNytt(data())).toHaveLength(2)
  })
})

describe('banderoll', () => {
  it('lansering: "Nytt på Samhällsinformation", stil Nyhet, länk till /uppdateringar', () => {
    expect(banderoll(data(), 'lansering', 'besokare')).toMatchObject({
      rubrik: 'Nytt på Samhällsinformation', message: 'Filtrera på plats', stil: 'Nyhet', lankUrl: '/uppdateringar', audience: 'Alla',
    })
  })

  it('annonsering: "Kommer 15 november", stil Kommande', () => {
    expect(banderoll(data({ annonsera: true }), 'annonsering', 'besokare'))
      .toMatchObject({ rubrik: 'Kommer 15 november', stil: 'Kommande' })
  })

  it('bara inloggade-punkter: målgrupp Användare, syns inte för besökare', () => {
    const d = data({ punkter: [{ typ: 'ny-funktion', plats: 'Konto', text: 'x', synlighet: 'inloggade' }] })
    expect(banderoll(d, 'lansering', 'besokare')).toBeNull()
    expect(banderoll(d, 'lansering', 'inloggad')).toMatchObject({ audience: 'Användare' })
  })

  it('ingen banderoll utan schemaläggning (skapas av bakgrundstjänsten)', () => {
    expect(banderoll(data({ schemalagd: false }), 'lansering', 'inloggad')).toBeNull()
  })
})

describe('push', () => {
  it('lansering: titel "Ny version: 0.9.0" och meddelandet', () => {
    expect(push(data(), 'lansering')).toEqual({ titel: 'Ny version: 0.9.0', text: 'Nu kan du filtrera' })
  })

  it('annonsering med Skicka vid = Båda: titel "Kommer 15 november"', () => {
    expect(push(data({ annonsera: true, pushSkickaVid: 'Båda' }), 'annonsering'))
      .toEqual({ titel: 'Kommer 15 november', text: 'Nu kan du filtrera' })
  })

  it('ingen push i en fas som inte är vald', () => {
    expect(push(data({ annonsera: true, pushSkickaVid: 'Lansering' }), 'annonsering')).toBeNull()
  })

  it('tomt meddelande faller tillbaka på titeln, som backend', () => {
    expect(push(data({ pushMeddelande: '' }), 'lansering')?.text).toBe('Filtrera på plats')
  })
})

describe('checklista', () => {
  const texter = (d: FörhandsData) => checklista(d).map(p => `${p.nivå}: ${p.text}`)

  it('varnar när besökare inte ser något alls', () => {
    const d = data({ punkter: [{ typ: 'ny-funktion', plats: 'Konto', text: 'x', synlighet: 'inloggade' }] })
    expect(texter(d).some(t => t.startsWith('varning: Besökare ser ingenting'))).toBe(true)
  })

  it('varnar när "Endast inloggade"-punkter inte syns någonstans för att Profil → Uppdateringar är av', () => {
    expect(texter(data({ profilUppdateringarPå: false })).some(t => t.includes('syns bara i Vad är nytt-rutan'))).toBe(true)
  })

  it('upplyser om att pushen länkar till en avstängd sida', () => {
    expect(texter(data({ profilUppdateringarPå: false })).some(t => t.startsWith('info: Pushen öppnar Profil'))).toBe(true)
  })

  it('varnar för push utan version', () => {
    expect(texter(data({ pushVersion: ' ' })).some(t => t.includes('version eller meddelande saknas'))).toBe(true)
  })

  it('frågar om Vad är nytt saknas för en "Ny funktion"', () => {
    expect(texter(data({ visaVadArNytt: false })).some(t => t.includes('Avsiktligt?'))).toBe(true)
  })

  it('räknar opublicerade FAQ-frågor', () => {
    const d = data({ kopplatFaq: [{ fraga: 'a', publicerad: true }, { fraga: 'b', publicerad: false }] })
    expect(texter(d).some(t => t.includes('2 FAQ-frågor') && t.includes('varav 1 opublicerad'))).toBe(true)
  })

  it('frågar när nyhetens datum inte är lanseringsdagen', () => {
    expect(texter(data({ datum: '2026-11-02' })).some(t => t.includes('datumet 2 november, men lanseringen är 15 november'))).toBe(true)
  })

  it('inget att anmärka på när allt är ifyllt och synligt', () => {
    expect(checklista(data())[0]).toEqual({ nivå: 'ok', text: 'Inget att anmärka på.' })
  })
})
