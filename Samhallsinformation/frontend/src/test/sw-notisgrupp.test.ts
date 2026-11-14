import { beforeAll, describe, expect, it } from 'vitest'
// ?raw + new Function i stället för import: filen är ett klassiskt
// service worker-skript (importScripts) och inte en modul.
import notisgruppJs from '../../public/sw-notisgrupp.js?raw'
import swJs from '../../public/sw.js?raw'

type Grupp = { tag: string; antal: number; etikett: string; url: string }
type PushData = { body?: string; url?: string; grupp?: Grupp }
type NotisData = { url: string; antal: number; senastAviseradAt: number }
type Notis = { tag: string; body: string; renotify: boolean; data: NotisData }
type Bygg = (data: PushData, befintlig: NotisData | null, nu: number) => Notis | null

let bygg: Bygg

beforeAll(() => {
  const fakeSelf: { byggGrupperadNotis?: Bygg } = {}
  new Function('self', notisgruppJs)(fakeSelf)
  bygg = fakeSelf.byggGrupperadNotis!
})

const trafikverket = (antal: number): PushData => ({
  body:
    antal === 1 ? '1 ny händelse från Trafikverket' : `${antal} nya händelser från Trafikverket`,
  url: antal === 1 ? '/?shortName=Trafikverket&handelse=abc' : '/?shortName=Trafikverket',
  grupp: { tag: 'kalla-5', antal, etikett: 'från Trafikverket', url: '/?shortName=Trafikverket' },
})

describe('sw-notisgrupp: sammanslagning av notiser per källa', () => {
  it('första pushen visas med sin egen text och länk', () => {
    const notis = bygg(trafikverket(1), null, 1000)!
    expect(notis.tag).toBe('kalla-5')
    expect(notis.body).toBe('1 ny händelse från Trafikverket')
    expect(notis.data.url).toBe('/?shortName=Trafikverket&handelse=abc')
    expect(notis.data.antal).toBe(1)
    expect(notis.renotify).toBe(true)
  })

  it('en flod av köade pushar summeras till en notis', () => {
    // Scenariot från feedbacken: datorn startar och tio pushar kommer på en gång.
    let befintlig: NotisData | null = null
    let notis: Notis | null = null
    for (const antal of [2, 1, 3, 2, 1, 4, 2, 1, 3, 2]) {
      notis = bygg(trafikverket(antal), befintlig, 1000)
      befintlig = notis!.data
    }
    expect(notis!.body).toBe('21 nya händelser från Trafikverket')
    expect(notis!.data.url).toBe('/?shortName=Trafikverket')
  })

  it('plingar bara för den första i en flod, sedan tyst uppdatering', () => {
    const forsta = bygg(trafikverket(2), null, 1000)!
    const andra = bygg(trafikverket(1), forsta.data, 1500)!
    expect(forsta.renotify).toBe(true)
    expect(andra.renotify).toBe(false)
    // Tidpunkten för senaste aviseringen flyttas inte av en tyst uppdatering.
    expect(andra.data.senastAviseradAt).toBe(1000)
  })

  it('plingar igen när en ny push kommer långt senare', () => {
    const forsta = bygg(trafikverket(2), null, 0)!
    const senare = bygg(trafikverket(1), forsta.data, 10 * 60 * 1000)!
    expect(senare.renotify).toBe(true)
    expect(senare.body).toBe('3 nya händelser från Trafikverket')
  })

  it('sammanslagen länk går till källflödet, aldrig till en enskild händelse', () => {
    const forsta = bygg(trafikverket(1), null, 0)!
    const andra = bygg(trafikverket(1), forsta.data, 100)!
    expect(andra.body).toBe('2 nya händelser från Trafikverket')
    expect(andra.data.url).toBe('/?shortName=Trafikverket')
  })

  it('pushar utan grupp (testpush, ärenden, ny version) grupperas inte', () => {
    expect(bygg({ body: 'Testpush' }, null, 0)).toBeNull()
  })

  it('sw.js laddar hjälpfilen och använder den', () => {
    expect(swJs).toContain("importScripts('/sw-notisgrupp.js')")
    expect(swJs).toContain('byggGrupperadNotis')
  })
})
