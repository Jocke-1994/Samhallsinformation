import type { PunktRequest, PushSkickaVid, UppdateringsPunkt } from '../api/uppdateringar'
import type { MaintenanceBanner } from '../api/maintenanceBanners'

// Ren logik för förhandsvisningen i Uppdateringar (Ideer/Uppdateringar-forhandsvisning.md).
// Texterna här SPEGLAR backend — ändras de där måste de ändras här:
//  - banderoll + push vid lansering/annonsering: ScheduledReleaseBackgroundService.cs
//  - "Släpps X"-teasern:                        UppdateringarController.MedAnnonseringsteaser
//  - datumformatet "15 november":               SvenskDatum.FormateraDag

export type VisaSom = 'besokare' | 'inloggad'
export type Fas = 'annonsering' | 'lansering'

export interface FörhandsData {
  titel:          string
  datum:          string          // yyyy-mm-dd
  punkter:        PunktRequest[]
  schemalagd:     boolean
  schemaDatum:    string          // datetime-local, lansering
  annonsera:      boolean
  annonseDatum:   string          // datetime-local
  skickaPush:     boolean
  pushVersion:    string
  pushMeddelande: string
  pushSkickaVid:  PushSkickaVid
  visaBanderoll:  boolean
  visaVadArNytt:  boolean
  valdaFlaggor:   string[]
  kopplatFaq:     { fraga: string; publicerad: boolean }[]
  /** Är Profil → Uppdateringar påslagen? (flaggorna uppdateringar_senaste/historik) */
  profilUppdateringarPå: boolean
  /** Är Vad är nytt-rutan påslagen, nu eller av lanseringen? (uppdateringar_vad_ar_nytt) */
  vadArNyttPå?: boolean
}

const MÅNADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** "15 november" — samma format som backendens SvenskDatum.FormateraDag. */
export function formateraDag(lokal: string): string {
  const d = new Date(lokal)
  return Number.isNaN(d.getTime()) ? '…' : `${d.getDate()} ${MÅNADER[d.getMonth()]}`
}

const harAnnonsering = (d: FörhandsData) => d.schemalagd && d.annonsera
const ifyllda = (d: FörhandsData) => d.punkter.filter(p => p.text.trim() !== '')

function somPunkter(ps: PunktRequest[]): UppdateringsPunkt[] {
  return ps.map((p, i) => ({ ...p, id: `forhands-${i}` }))
}

function teaser(d: FörhandsData): UppdateringsPunkt[] {
  return [{ id: 'teaser', typ: 'kommer-snart', plats: 'Allmänt', text: `Släpps ${formateraDag(d.schemaDatum)}`, synlighet: 'alla' }]
}

/** Nyheter-sidan visar bara "alla"-punkter, även för inloggade (UppdateringarPage). */
export function punkterNyhetersidan(d: FörhandsData, fas: Fas): UppdateringsPunkt[] {
  if (harAnnonsering(d) && fas === 'annonsering') return teaser(d)
  return somPunkter(ifyllda(d).filter(p => p.synlighet === 'alla'))
}

/** Profil → Uppdateringar: bara inloggade, och de ser ALLA punkter (även "Endast inloggade").
 *  Under annonseringen visas samma teaser som på Nyheter-sidan (backendens MedAnnonseringsteaser). */
export function punkterProfilen(d: FörhandsData, fas: Fas): UppdateringsPunkt[] {
  if (harAnnonsering(d) && fas === 'annonsering') return teaser(d)
  return somPunkter(ifyllda(d))
}

/** Vad är nytt-rutan: bara inloggade, alla deras punkter, aldrig under annonseringen. */
export function punkterVadÄrNytt(d: FörhandsData): UppdateringsPunkt[] {
  return somPunkter(ifyllda(d))
}

export function banderollMålgrupp(d: FörhandsData): 'Alla' | 'Användare' {
  return ifyllda(d).some(p => p.synlighet === 'alla') ? 'Alla' : 'Användare'
}

/** Banderollen precis som bakgrundstjänsten skapar den, eller null om den inte syns. */
export function banderoll(d: FörhandsData, fas: Fas, som: VisaSom): MaintenanceBanner | null {
  if (!d.schemalagd || !d.visaBanderoll || ifyllda(d).length === 0) return null
  if (fas === 'annonsering' && !harAnnonsering(d)) return null
  if (som === 'besokare' && banderollMålgrupp(d) === 'Användare') return null
  const komm = fas === 'annonsering'
  return {
    id: 'forhandsvisning', message: d.titel || '(ingen titel)',
    rubrik: komm ? `Kommer ${formateraDag(d.schemaDatum)}` : 'Nytt på Samhällsinformation',
    stil: komm ? 'Kommande' : 'Nyhet', lankUrl: '/uppdateringar',
    audience: banderollMålgrupp(d), startUtc: '', endUtc: '',
  }
}

/** Pushen precis som PushDispatcher.DispatchNewVersionAsync skickar den, eller null. */
export function push(d: FörhandsData, fas: Fas): { titel: string; text: string } | null {
  if (!d.schemalagd || !d.skickaPush || ifyllda(d).length === 0) return null
  const vid = harAnnonsering(d) ? d.pushSkickaVid : 'Lansering'
  const gäller = vid === 'Båda' || (fas === 'annonsering' ? vid === 'Annonsering' : vid === 'Lansering')
  if (!gäller) return null
  return {
    titel: fas === 'annonsering' ? `Kommer ${formateraDag(d.schemaDatum)}` : `Ny version: ${d.pushVersion.trim()}`,
    text:  d.pushMeddelande.trim() || d.titel,
  }
}

export interface Punkt { nivå: 'varning' | 'info' | 'ok'; text: string }

/** "Innan du publicerar" — stoppar inget, men gör att inget går obemärkt förbi. */
export function checklista(d: FörhandsData): Punkt[] {
  const ut: Punkt[] = []
  const ps = ifyllda(d)
  const tomma = d.punkter.length - ps.length
  const allaPunkter = ps.filter(p => p.synlighet === 'alla')
  const inloggadePunkter = ps.filter(p => p.synlighet === 'inloggade')

  if (!d.titel.trim()) ut.push({ nivå: 'varning', text: 'Titel saknas.' })
  if (tomma > 0) ut.push({ nivå: 'varning', text: `${tomma} rad${tomma === 1 ? '' : 'er'} utan text — fyll i eller ta bort.` })
  if (ps.length > 0 && allaPunkter.length === 0)
    ut.push({ nivå: 'varning', text: 'Besökare ser ingenting: alla punkter är "Endast inloggade", så uppdateringen syns inte på Nyheter-sidan.' })
  if (inloggadePunkter.length > 0 && !d.profilUppdateringarPå)
    ut.push({ nivå: 'varning', text: `${inloggadePunkter.length} punkt${inloggadePunkter.length === 1 ? '' : 'er'} "Endast inloggade" syns bara i Vad är nytt-rutan${d.visaVadArNytt ? '' : ' (som inte är ikryssad)'} — Profil → Uppdateringar är avstängd.` })
  if (d.schemalagd && d.skickaPush && (!d.pushVersion.trim() || !d.pushMeddelande.trim()))
    ut.push({ nivå: 'varning', text: 'Push är ikryssad men version eller meddelande saknas.' })
  if (d.schemalagd && d.skickaPush && !d.profilUppdateringarPå)
    ut.push({ nivå: 'info', text: 'Pushen öppnar Profil → Uppdateringar, som är avstängd. Mottagaren landar på en tom sida.' })
  // "Datum" är ett eget fält som inte följer schemat — nyheten visar det datumet.
  if (d.schemalagd && d.datum && d.schemaDatum && d.datum !== d.schemaDatum.slice(0, 10))
    ut.push({ nivå: 'info', text: `Nyheten visar datumet ${formateraDag(d.datum)}, men lanseringen är ${formateraDag(d.schemaDatum)}. Avsiktligt?` })
  if (d.visaVadArNytt && d.vadArNyttPå === false)
    ut.push({ nivå: 'varning', text: 'Vad är nytt är ikryssad, men själva rutan är avstängd för användarna (uppdateringar_vad_ar_nytt). Välj flaggan i lanseringen, annars ser ingen den.' })
  if (ps.some(p => p.typ === 'ny-funktion') && !d.visaVadArNytt)
    ut.push({ nivå: 'info', text: 'En punkt är "Ny funktion" men Vad är nytt är inte ikryssad. Avsiktligt?' })
  const opublicerade = d.kopplatFaq.filter(f => !f.publicerad).length
  if (d.kopplatFaq.length > 0)
    ut.push({ nivå: 'info', text: `${d.kopplatFaq.length} FAQ-fråg${d.kopplatFaq.length === 1 ? 'a' : 'or'} kopplad${d.kopplatFaq.length === 1 ? '' : 'e'} till flaggorna${opublicerade ? `, varav ${opublicerade} opublicerad${opublicerade === 1 ? '' : 'e'}` : ''}. Har du kollat texten?` })
  if (d.schemalagd && d.valdaFlaggor.length > 0)
    ut.push({ nivå: 'ok', text: `${d.valdaFlaggor.length} flagg${d.valdaFlaggor.length === 1 ? 'a' : 'or'} slås på ${formateraDag(d.schemaDatum)}.` })
  if (ut.every(p => p.nivå === 'ok')) ut.unshift({ nivå: 'ok', text: 'Inget att anmärka på.' })
  return ut
}
