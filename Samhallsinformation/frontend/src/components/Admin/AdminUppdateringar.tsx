import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendNewVersionNotice } from '../../api/push'
import {
  fetchAdminUppdateringar, createUppdatering, updateUppdatering, deleteUppdatering,
  type Uppdatering, type UppdateringRequest, type UppdateringsPunkt, type PunktRequest,
  type PunktTyp, type Synlighet, type PushSkickaVid,
} from '../../api/uppdateringar'
import { fetchAdminFeatureFlags } from '../../api/featureFlags'
import { ADMIN_FLAGG_QUERY_KEY, invalideraFlaggor } from '../../lib/flaggCache'
import { fetchAdminFaq } from '../../api/faq'
import { isoTillDatetimeLocal } from '../../lib/tid'
import ConfirmDialog from '../common/ConfirmDialog'
import { HamtningsFel, MutationFel } from '../common/HamtningsStatus'
import { visaFel } from '../../lib/felmeddelande'
import { getTypConfig, PUNKT_TYPER } from '../../lib/uppdateringTyp'

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const ALLA_TYPER:    Array<PunktTyp | 'Alla'>  = ['Alla', 'ny-funktion', 'förbättring', 'buggfix', 'känt-problem', 'kommer-snart']
const ALLA_STATUSAR: Array<'publicerad' | 'utkast' | 'Alla'> = ['Alla', 'publicerad', 'utkast']
const PLATS_OPTIONS = ['Allmänt', 'Nyhetsflöde', 'Mina källor', 'Notifieringar', 'Konto']
const ALLA_TYPER_FORM = PUNKT_TYPER

function typSummary(punkter: { typ: PunktTyp }[]) {
  const seen = new Map<PunktTyp, number>()
  for (const p of punkter) seen.set(p.typ, (seen.get(p.typ) ?? 0) + 1)
  return Array.from(seen.entries()).map(([typ, antal]) => ({ typ, antal }))
}

// ---------------------------------------------------------------------------
// Skicka "Ny version"-notis — riktig, fristående funktion (kopplad mot
// PushDispatcher.DispatchNewVersionAsync). Fristående från listan nedan.
// ---------------------------------------------------------------------------

function SkickaNyVersionKort() {
  const [version, setVersion] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [resultat, setResultat] = useState<string | null>(null)
  const [fel, setFel] = useState('')
  const [bekräfta, setBekräfta] = useState(false)

  const kanSkicka = version.trim() !== '' && meddelande.trim() !== '' && !skickar

  async function skicka() {
    setBekräfta(false)
    setSkickar(true)
    setFel('')
    setResultat(null)
    try {
      const { sent } = await sendNewVersionNotice(version.trim(), meddelande.trim())
      setResultat(sent === 0 ? 'Skickat — men ingen hade opt:at in på "Ny version" än.' : `Skickat till ${sent} enhet${sent === 1 ? '' : 'er'}.`)
      setVersion('')
      setMeddelande('')
    } catch (err) {
      setFel(visaFel(err, 'Notisen kunde inte skickas. Försök igen.'))
    } finally {
      setSkickar(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-violet-100 bg-violet-50">
        <h2 className="text-sm font-bold text-violet-800">Skicka "Ny version"-notis</h2>
        <p className="text-xs text-violet-500 mt-0.5">
          Riktig push till alla som slagit på kategorin Ny version under Konto — fristående från listan nedan.
        </p>
      </div>
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="T.ex. 0.6.0"
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <input
            type="text"
            value={meddelande}
            onChange={e => setMeddelande(e.target.value)}
            placeholder="T.ex. 'Nya källor och en snabbare sidomeny'"
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBekräfta(true)}
            disabled={!kanSkicka}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            {skickar ? 'Skickar…' : 'Skicka nu'}
          </button>
          {resultat && <p className="text-sm text-green-600">{resultat}</p>}
          {fel && <p role="alert" className="text-sm text-red-500">{fel}</p>}
        </div>
      </div>
      {bekräfta && (
        <ConfirmDialog
          rubrik={'Skicka "Ny version"-notis till alla?'}
          bekräftaText="Skicka till alla"
          onBekräfta={skicka}
          onAvbryt={() => setBekräfta(false)}
        >
          <p>
            Det här är en <strong>riktig push-notis</strong> som skickas direkt till alla
            prenumeranter som slagit på kategorin Ny version. Den kan inte återkallas.
          </p>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Version</p>
            <p className="text-sm text-slate-800 break-words">{version.trim()}</p>
            <p className="text-xs text-slate-500 mt-2">Meddelande</p>
            <p className="text-sm text-slate-800 break-words">{meddelande.trim()}</p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ta bort-modal
// ---------------------------------------------------------------------------

function TaBortModal({ titel, onBekräfta, onStäng, fel, arIgang }: {
  titel: string; onBekräfta: () => void; onStäng: () => void; fel?: unknown; arIgang?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <h2 className="text-lg font-bold text-white">Ta bort uppdatering</h2>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">"{titel}"</strong> tas bort permanent. Åtgärden kan inte ångras.
          </p>
          <MutationFel fel={fel} reserv="Uppdateringen kunde inte tas bort. Försök igen." />
          <div className="flex gap-3">
            <button onClick={onStäng} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={onBekräfta} disabled={arIgang} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">{arIgang ? 'Tar bort...' : 'Ta bort'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulärpanel
// ---------------------------------------------------------------------------

interface PunktFormRad extends PunktRequest {
  radId: number
}

function nyPunkt(radId: number): PunktFormRad {
  return { radId, typ: 'ny-funktion', plats: 'Allmänt', text: '', synlighet: 'alla' }
}

let nästaRadId = 0

function FormPanel({ redigerar, onSpara, onStäng, sparar, fel }: {
  redigerar: Uppdatering | null
  onSpara:   (data: UppdateringRequest) => void
  onStäng:   () => void
  sparar?:   boolean
  fel?:      unknown
}) {
  const [titel,      setTitel]      = useState(redigerar?.titel ?? '')
  const [datum,      setDatum]      = useState(redigerar?.datum.split('T')[0] ?? new Date().toISOString().split('T')[0])
  const [publicerad, setPublicerad] = useState(redigerar?.publicerad ?? false)
  // Bara en HELT NY post får en tom startrad injicerad — redigeras en
  // befintlig post visas exakt vad som är sparat, även 0 rader (en giltig
  // ren flagg-schemaläggning). Att injicera en rad även vid 0 sparade
  // punkter gjorde tidigare formuläret osparbart vid omöppning (code
  // review-fynd, PR #590): kanSpara blev false direkt eftersom den
  // injicerade raden hade tom text, utan någon förklaring i UI:t.
  const [punkter, setPunkter] = useState<PunktFormRad[]>(
    redigerar
      ? redigerar.punkter.map(p => ({ radId: nästaRadId++, typ: p.typ, plats: p.plats, text: p.text, synlighet: p.synlighet }))
      : [nyPunkt(nästaRadId++)]
  )

  // Schemalagd lansering — ett delat datum/tid för både changelog-
  // publicering OCH aktivering av valda feature-flaggor (se
  // ScheduledReleaseBackgroundService på backend).
  const [schemalagd,   setSchemalagd]   = useState(redigerar?.schemalagdPubliceringUtc != null)
  const [schemaDatum,  setSchemaDatum]  = useState(redigerar?.schemalagdPubliceringUtc ? isoTillDatetimeLocal(redigerar.schemalagdPubliceringUtc) : '')
  const [valdaFlaggor, setValdaFlaggor] = useState<string[]>(redigerar?.schemalagdaFlaggor ?? [])

  // Del 2 av Schemalagd lanserings "Ny version"-tillägg (Beslut 2026-10-08) —
  // skapas av ScheduledReleaseBackgroundService vid lanseringstidpunkten,
  // inte här vid sparande.
  const [skickaPush,     setSkickaPush]     = useState(redigerar?.skickaPush ?? false)
  const [pushVersion,    setPushVersion]    = useState(redigerar?.pushVersion ?? '')
  const [pushMeddelande, setPushMeddelande] = useState(redigerar?.pushMeddelande ?? '')
  const [visaBanderoll,  setVisaBanderoll]  = useState(redigerar?.visaBanderoll ?? false)

  // Del 3: annonsering i förväg (Beslut 2026-10-08) — en andra, tidigare
  // tidpunkt. Posten visas som en "Kommer snart"-teaser från den tidpunkten
  // tills schemaDatum (lanseringen) ovan slår in.
  const [annonsera,     setAnnonsera]     = useState(redigerar?.annonseringUtc != null)
  const [annonseDatum,  setAnnonseDatum]  = useState(redigerar?.annonseringUtc ? isoTillDatetimeLocal(redigerar.annonseringUtc) : '')
  const [pushSkickaVid, setPushSkickaVid] = useState<PushSkickaVid>(redigerar?.pushSkickaVid ?? 'Lansering')

  const flaggFråga = useQuery({ queryKey: ADMIN_FLAGG_QUERY_KEY, queryFn: fetchAdminFeatureFlags })
  const adminFlaggor = flaggFråga.data ?? []
  const redoFlaggor = adminFlaggor.filter(f => f.redoAttLanseras && !f.value)

  const { data: faqItems = [] } = useQuery({ queryKey: ['admin-faq'], queryFn: fetchAdminFaq })
  const kopplatFaq = faqItems.filter(f => f.flagKey && valdaFlaggor.includes(f.flagKey))

  function toggleFlagga(key: string) {
    setValdaFlaggor(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function addPunkt() { setPunkter(prev => [...prev, nyPunkt(nästaRadId++)]) }

  function removePunkt(radId: number) {
    setPunkter(prev => prev.filter(p => p.radId !== radId))
  }

  function updatePunkt<K extends keyof PunktFormRad>(radId: number, key: K, val: PunktFormRad[K]) {
    setPunkter(prev => prev.map(p => p.radId === radId ? { ...p, [key]: val } : p))
  }

  // En schemalagd lansering med minst en flagga vald får sakna innehåll
  // helt (en ren flagg-aktivering utan publik nyhet) — men en vanlig, ej
  // schemalagd post kräver fortfarande minst en rad text som förut. Samma
  // regel användes tidigare på två ställen (här och i "ta bort rad"-
  // spärren nedan), en gång rakt av och en gång som en dubbel negation —
  // en enda delad boolean istället (code review-fynd, PR #590).
  const kanHaNollPunkter = schemalagd && valdaFlaggor.length > 0
  const harInnehåll      = punkter.length > 0 && punkter.every(p => p.text.trim() !== '')
  const rentFlaggSchema  = kanHaNollPunkter && punkter.length === 0
  // E6#18: `type="date"`/`datetime-local` går att tömma helt — `new Date('')` är en
  // Invalid Date vars `toISOString()` kastar ett `RangeError` i klickhanteraren
  // (ingen felruta, knappen ser bara "död" ut). Både publiceringsdatumet och ett
  // ev. schemalagt datum/tid valideras nu innan de får skickas.
  const datumGiltigt       = datum !== '' && !Number.isNaN(new Date(datum).getTime())
  const schemaDatumGiltigt = !schemalagd || (schemaDatum !== '' && !Number.isNaN(new Date(schemaDatum).getTime()))
  // En banderoll har ingenting att visa utan riktigt innehåll — samma spärr
  // som backend (UppdateringarController.ValideraPunkter). Målgruppen
  // härleds från punkternas "Syns för" så formuläret aldrig gissar.
  const kanVisaBanderoll = harInnehåll
  const banderollMålgrupp = punkter.some(p => p.synlighet === 'alla') ? 'alla (även besökare)' : 'bara inloggade'
  const pushGiltigt = !skickaPush || (pushVersion.trim() !== '' && pushMeddelande.trim() !== '')
  // Del 3: annonseringsdatumet måste vara giltigt OCH ligga före lanseringen
  // (samma regel som backend, UppdateringarController.ValideraPunkter).
  const annonseDatumGiltigt = !annonsera || (annonseDatum !== '' && !Number.isNaN(new Date(annonseDatum).getTime()))
  const annonseFoeLansering = !annonsera || !schemaDatum || new Date(annonseDatum) < new Date(schemaDatum)
  const kanSpara = titel.trim() !== '' && datumGiltigt && schemaDatumGiltigt && pushGiltigt
    && (!schemalagd || (annonseDatumGiltigt && annonseFoeLansering))
    && (harInnehåll || rentFlaggSchema)

  function spara(publicera: boolean) {
    if (sparar || !kanSpara) return
    onSpara({
      titel: titel.trim(),
      datum: new Date(datum).toISOString(),
      publicerad: schemalagd ? false : publicera,
      punkter: punkter.map(({ typ, plats, text, synlighet }) => ({ typ, plats, text, synlighet })),
      schemalagdPubliceringUtc: schemalagd && schemaDatum ? new Date(schemaDatum).toISOString() : null,
      schemalagdaFlaggor: schemalagd ? valdaFlaggor : [],
      skickaPush:     schemalagd && skickaPush,
      pushVersion:    schemalagd && skickaPush ? pushVersion.trim() : null,
      pushMeddelande: schemalagd && skickaPush ? pushMeddelande.trim() : null,
      visaBanderoll:  schemalagd && visaBanderoll && kanVisaBanderoll,
      annonseringUtc: schemalagd && annonsera && annonseDatum ? new Date(annonseDatum).toISOString() : null,
      pushSkickaVid:  schemalagd && annonsera ? pushSkickaVid : 'Lansering',
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onStäng} />
      <div className="fixed top-0 right-0 bottom-0 z-40 w-[560px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {redigerar ? 'Redigera uppdatering' : 'Ny uppdatering'}
          </h2>
          <button onClick={onStäng} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Titel */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Titel</label>
            <input
              type="text"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="T.ex. 'Logga in och skapa konto'"
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Datum + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={e => setDatum(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
              <div className="flex gap-2 h-[42px]">
                {([false, true] as boolean[]).map(p => (
                  <button key={String(p)} onClick={() => setPublicerad(p)}
                    className={`flex-1 rounded-xl text-sm font-medium border transition-colors ${
                      publicerad === p
                        ? (p ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200')
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}>
                    {p ? 'Publicerad' : 'Utkast'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Schemalägg lansering */}
          <div className="flex flex-col gap-3 border border-slate-200 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={schemalagd}
                onChange={e => setSchemalagd(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
              />
              Schemalägg lansering
            </label>

            {schemalagd && (
              <div className="flex flex-col gap-3 pl-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Datum/tid (din lokala tid)</label>
                  <input
                    type="datetime-local"
                    value={schemaDatum}
                    onChange={e => setSchemaDatum(e.target.value)}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                {/* Del 3: annonsering i förväg (Beslut 2026-10-08) — en andra,
                    tidigare tidpunkt. Posten visas som "Kommer snart" från
                    den tidpunkten tills lanseringen ovan slår in. */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annonsera}
                      onChange={e => setAnnonsera(e.target.checked)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                    />
                    Annonsera i förväg
                  </label>
                  {annonsera && (
                    <div className="flex flex-col gap-1.5 pl-6">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Annonseringsdatum/tid (din lokala tid)</label>
                      <input
                        type="datetime-local"
                        value={annonseDatum}
                        onChange={e => setAnnonseDatum(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      />
                      {!annonseFoeLansering && (
                        <p className="text-xs text-red-500">Måste vara före lanseringsdatumet.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Flaggor att aktivera</label>
                  {flaggFråga.isError && flaggFråga.data === undefined ? (
                    <HamtningsFel
                      fel={flaggFråga.error}
                      reserv="Kunde inte hämta flaggorna. Listan är inte tom — den gick bara inte att läsa."
                      onForsokIgen={() => { void flaggFråga.refetch() }}
                      arIgang={flaggFråga.isFetching}
                      className="items-start text-left"
                    />
                  ) : redoFlaggor.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Inga flaggor är markerade "redo att lanseras" än — gör det i Feature flags-panelen, eller flytta en idé till "lanseringsklar" i Funktionsidéer.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {redoFlaggor.map(f => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleFlagga(f.key)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                            valdaFlaggor.includes(f.key)
                              ? 'bg-violet-100 text-violet-700 border-violet-200'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {f.key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Del 4: FAQ-listan i formuläret (Beslut 2026-10-08) — inget
                    nytt beteende, bara synliggjort. FaqItem.FlagKey styr
                    redan den faktiska visningen (session 42). */}
                {kopplatFaq.length > 0 && (
                  <div className="flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-amber-800">
                      {kopplatFaq.length} FAQ-{kopplatFaq.length === 1 ? 'fråga' : 'frågor'} kopplad{kopplatFaq.length === 1 ? '' : 'e'} till valda flaggor:
                    </p>
                    <ul className="flex flex-col gap-1">
                      {kopplatFaq.map(f => (
                        <li key={f.id} className="text-xs text-amber-700 flex items-start justify-between gap-2">
                          <span className="flex-1">{f.fraga}</span>
                          <span className={`shrink-0 font-medium ${f.publicerad ? 'text-green-700' : 'text-slate-500'}`}>
                            {f.publicerad ? 'Syns vid lansering' : 'Förblir dold'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-600">Granska/uppdatera dem i FAQ-fliken innan lansering.</p>
                  </div>
                )}

                {/* Del 2: push + banderoll vid lansering (Beslut 2026-10-08).
                    Skapas av bakgrundstjänsten vid lanseringstidpunkten, inte
                    nu vid sparande. */}
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skickaPush}
                      onChange={e => {
                        const checked = e.target.checked
                        setSkickaPush(checked)
                        if (checked && pushMeddelande.trim() === '') setPushMeddelande(titel)
                      }}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                    />
                    Skicka push till inloggade
                  </label>
                  {skickaPush && (
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 pl-6">
                      <input
                        type="text"
                        value={pushVersion}
                        onChange={e => setPushVersion(e.target.value)}
                        placeholder="Version, t.ex. 0.9.0"
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      />
                      <input
                        type="text"
                        value={pushMeddelande}
                        onChange={e => setPushMeddelande(e.target.value)}
                        placeholder="Pushens meddelande"
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                  )}
                  {skickaPush && annonsera && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-slate-400 shrink-0">Skicka vid</span>
                      {(['Annonsering', 'Lansering', 'Båda'] as PushSkickaVid[]).map(v => (
                        <button key={v} type="button" onClick={() => setPushSkickaVid(v)}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                            pushSkickaVid === v
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${kanVisaBanderoll ? 'text-slate-700' : 'text-slate-400 cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={visaBanderoll}
                      disabled={!kanVisaBanderoll}
                      onChange={e => setVisaBanderoll(e.target.checked)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 disabled:opacity-40"
                    />
                    Visa banderoll på sajten
                  </label>
                  {!kanVisaBanderoll ? (
                    <p className="text-xs text-slate-400 pl-6">Kräver minst en ifylld innehållsrad.</p>
                  ) : visaBanderoll ? (
                    <p className="text-xs text-slate-400 pl-6">Visas för: {banderollMålgrupp}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Innehåll</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Punkter */}
          <div className="flex flex-col gap-3">
            {punkter.map((p, idx) => (
              <div key={p.radId} className="border border-slate-200 rounded-xl overflow-hidden">

                {/* Topprad: nummer + typ-pills + plats + ta bort */}
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}</span>

                  {/* Typ-pills */}
                  <div className="flex gap-1 flex-wrap flex-1">
                    {ALLA_TYPER_FORM.map(t => (
                      <button key={t} onClick={() => updatePunkt(p.radId, 'typ', t)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          p.typ === t ? getTypConfig(t).formPillAktiv : getTypConfig(t).formPill
                        }`}>
                        {getTypConfig(t).adminLabel}
                      </button>
                    ))}
                  </div>

                  {/* Plats */}
                  <select
                    value={p.plats}
                    onChange={e => updatePunkt(p.radId, 'plats', e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-violet-400 shrink-0"
                  >
                    {PLATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>

                  {/* Ta bort */}
                  <button
                    onClick={() => removePunkt(p.radId)}
                    disabled={punkter.length === 1 && !kanHaNollPunkter}
                    className="text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors text-sm shrink-0"
                    title="Ta bort rad"
                  >
                    ✕
                  </button>
                </div>

                {/* Text */}
                <div className="px-3 py-2">
                  <input
                    type="text"
                    value={p.text}
                    onChange={e => updatePunkt(p.radId, 'text', e.target.value)}
                    placeholder="Beskriv ändringen kort och tydligt..."
                    className="w-full text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none bg-transparent"
                  />
                </div>

                {/* Synlighet — vem ser den här punkten */}
                <div className="px-3 pb-2.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 shrink-0">Syns för</span>
                  {(['alla', 'inloggade'] as Synlighet[]).map(s => (
                    <button key={s} onClick={() => updatePunkt(p.radId, 'synlighet', s)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        p.synlighet === s
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}>
                      {s === 'alla' ? 'Alla (även besökare)' : 'Endast inloggade'}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={addPunkt}
              className="text-sm font-medium text-violet-600 hover:text-violet-800 border border-dashed border-violet-200 hover:border-violet-400 rounded-xl py-2.5 transition-colors"
            >
              + Lägg till rad
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-3 shrink-0">
          <MutationFel fel={fel} reserv="Uppdateringen kunde inte sparas. Din text finns kvar — försök igen." />

          {/* Sammanfattning — inget syns förrän schemat slår in (Beslut 2026-10-08). */}
          {schemalagd && annonsera && annonseDatum && (
            <ul className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <li>Vid {annonseDatum.replace('T', ' ')} (annonsering):</li>
              {harInnehåll && <li>• Uppdateringen publiceras som "Kommer snart"</li>}
              {skickaPush && (pushSkickaVid === 'Annonsering' || pushSkickaVid === 'Båda') && <li>• Push skickas till inloggade</li>}
              {visaBanderoll && kanVisaBanderoll && <li>• Banderoll visas för {banderollMålgrupp}</li>}
            </ul>
          )}
          {schemalagd && schemaDatum && (
            <ul className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <li>Vid {schemaDatum.replace('T', ' ')} ({annonsera ? 'lansering' : 'publicering'}):</li>
              {valdaFlaggor.length > 0 && <li>• {valdaFlaggor.length} flagg{valdaFlaggor.length === 1 ? 'a' : 'or'} aktiveras</li>}
              {harInnehåll && <li>• Uppdateringen {annonsera ? 'byts till sitt riktiga innehåll' : 'publiceras'}</li>}
              {skickaPush && (!annonsera || pushSkickaVid === 'Lansering' || pushSkickaVid === 'Båda') && <li>• Push skickas till inloggade med "Ny version"-notiser</li>}
              {visaBanderoll && kanVisaBanderoll && <li>• Banderoll visas för {banderollMålgrupp}</li>}
            </ul>
          )}
          <div className="flex gap-3">
          <button onClick={onStäng} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Avbryt
          </button>
          {schemalagd ? (
            <button
              onClick={() => kanSpara && spara(false)}
              disabled={!kanSpara || sparar}
              className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {sparar ? 'Sparar...' : schemaDatum ? `Sparas, publiceras automatiskt ${schemaDatum.replace('T', ' ')}` : 'Schemalägg'}
            </button>
          ) : (
            <>
              <button
                onClick={() => kanSpara && spara(false)}
                disabled={!kanSpara || sparar}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {sparar ? 'Sparar...' : 'Spara som utkast'}
              </button>
              <button
                onClick={() => kanSpara && spara(true)}
                disabled={!kanSpara || sparar}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {redigerar?.publicerad ? 'Uppdatera' : 'Publicera'}
              </button>
            </>
          )}
          </div>
        </div>

      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function AdminUppdateringar() {
  const queryClient = useQueryClient()
  const uppdFråga = useQuery({
    queryKey: ['admin-uppdateringar'],
    queryFn:  fetchAdminUppdateringar,
  })
  const uppdateringar = uppdFråga.data ?? []
  const uppdOkända = uppdFråga.data === undefined

  const [typFilter,     setTypFilter]     = useState<PunktTyp | 'Alla'>('Alla')
  const [statusFilter,  setStatusFilter]  = useState<'publicerad' | 'utkast' | 'Alla'>('Alla')
  const [panelÖppen,    setPanelÖppen]    = useState(false)
  const [redigerar,     setRedigerar]     = useState<Uppdatering | null>(null)
  const [taBort,        setTaBort]        = useState<Uppdatering | null>(null)

  function invalidera() {
    queryClient.invalidateQueries({ queryKey: ['admin-uppdateringar'] })
    queryClient.invalidateQueries({ queryKey: ['uppdateringar'] })
    // Publicering aktiverar flaggor server-side (ActivateFlagsAsync) — uppdatera
    // både publik och admin-flaggvy så ändringen syns direkt.
    invalideraFlaggor(queryClient)
  }

  const createMutation = useMutation({ mutationFn: createUppdatering, onSuccess: invalidera })
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; req: UppdateringRequest }) => updateUppdatering(vars.id, vars.req),
    onSuccess:  invalidera,
  })
  const deleteMutation = useMutation({ mutationFn: deleteUppdatering, onSuccess: invalidera })

  const filtrerade = uppdateringar.filter(u => {
    if (statusFilter !== 'Alla' && (statusFilter === 'publicerad') !== u.publicerad) return false
    if (typFilter !== 'Alla' && !u.punkter.some(p => p.typ === typFilter)) return false
    return true
  })

  function öppnaSkapa()                 { createMutation.reset(); updateMutation.reset(); setRedigerar(null); setPanelÖppen(true) }
  function öppnaRedigera(u: Uppdatering) { createMutation.reset(); updateMutation.reset(); setRedigerar(u);    setPanelÖppen(true) }
  function stängPanel()                 { setPanelÖppen(false); setRedigerar(null) }

  // Panelen stängs först när servern bekräftat (V3-8) — en uppdatering med flera rader
  // får inte försvinna vid ett 403/500/nätverksfel.
  const sparaLås = useRef(false) // ref: react-query meddelar asynkront, så isPending stoppar inte två klick i samma tick
  function spara(data: UppdateringRequest) {
    if (sparaLås.current) return
    sparaLås.current = true
    const villkor = { onSuccess: stängPanel, onSettled: () => { sparaLås.current = false } }
    if (redigerar) {
      updateMutation.mutate({ id: redigerar.id, req: data }, villkor)
    } else {
      createMutation.mutate(data, villkor)
    }
  }

  function togglePublicerad(u: Uppdatering) {
    if (updateMutation.isPending) return
    // Manuell publicera/avpublicera vinner över ett ev. väntande schema —
    // annars skulle en ihågkommen schemaläggning kunna publicera om posten
    // igen senare, mot admins uttryckliga handling här.
    const req: UppdateringRequest = {
      titel:      u.titel,
      datum:      u.datum,
      publicerad: !u.publicerad,
      punkter:    u.punkter.map(({ typ, plats, text, synlighet }: UppdateringsPunkt) => ({ typ, plats, text, synlighet })),
      schemalagdPubliceringUtc: null,
      schemalagdaFlaggor: [],
    }
    updateMutation.mutate({ id: u.id, req })
  }

  const antal = {
    totalt:      uppdateringar.length,
    publicerade: uppdateringar.filter(u => u.publicerad).length,
    utkast:      uppdateringar.filter(u => !u.publicerad).length,
  }

  return (
    <div className="flex flex-col gap-6">

      {taBort && (
        <TaBortModal
          titel={taBort.titel}
          onBekräfta={() => { if (!deleteMutation.isPending) deleteMutation.mutate(taBort.id, { onSuccess: () => setTaBort(null) }) }}
          onStäng={() => { deleteMutation.reset(); setTaBort(null) }}
          fel={deleteMutation.error}
          arIgang={deleteMutation.isPending}
        />
      )}

      {panelÖppen && (
        <FormPanel
          redigerar={redigerar}
          onSpara={spara}
          onStäng={stängPanel}
          sparar={createMutation.isPending || updateMutation.isPending}
          fel={redigerar ? updateMutation.error : createMutation.error}
        />
      )}

      {/* Misslyckad publicera/avpublicera (panelen visar sitt eget fel) */}
      {!panelÖppen && !taBort && (
        <MutationFel fel={updateMutation.error} reserv="Ändringen kunde inte sparas. Försök igen." className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3" />
      )}

      <SkickaNyVersionKort />

      {/* Stat-kort */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Totalt',      värde: antal.totalt,      färg: 'text-slate-800' },
          { label: 'Publicerade', värde: antal.publicerade, färg: 'text-green-600' },
          { label: 'Utkast',      värde: antal.utkast,      färg: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
            <p className={`text-3xl font-bold ${uppdOkända ? 'text-slate-300' : s.färg}`}>{uppdOkända ? '—' : s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Verktygsfält */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {ALLA_TYPER.map(t => (
              <button key={t} onClick={() => setTypFilter(t)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  typFilter === t
                    ? t === 'Alla' ? 'bg-violet-100 text-violet-700' : getTypConfig(t).listPill
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {t === 'Alla' ? 'Alla typer' : getTypConfig(t).adminLabel}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {ALLA_STATUSAR.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {s === 'Alla' ? 'Alla statusar' : s === 'publicerad' ? 'Publicerad' : 'Utkast'}
              </button>
            ))}
          </div>
          <button
            onClick={öppnaSkapa}
            className="ml-auto text-sm font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0"
          >
            + Ny uppdatering
          </button>
        </div>

        {/* Tabell */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Titel</th>
              <th className="text-left px-4 py-3 font-medium">Innehåll</th>
              <th className="text-left px-4 py-3 font-medium">Datum</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map(u => {
              const summary = typSummary(u.punkter)
              return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-800">{u.titel}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{u.punkter.length} {u.punkter.length === 1 ? 'rad' : 'rader'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {summary.map(({ typ, antal }) => (
                        <span key={typ} className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${getTypConfig(typ).listPill}`}>
                          {getTypConfig(typ).adminLabel}{antal > 1 ? ` ×${antal}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">{u.datum.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${
                        u.publicerad ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {u.publicerad ? 'Publicerad' : 'Utkast'}
                      </span>
                      {u.schemalagdPubliceringUtc && (
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 whitespace-nowrap"
                          title={`Schemalagd till ${isoTillDatetimeLocal(u.schemalagdPubliceringUtc).replace('T', ' ')}`}
                        >
                          ⏰ Schemalagd
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => togglePublicerad(u)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                          u.publicerad
                            ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}>
                        {u.publicerad ? 'Avpublicera' : 'Publicera'}
                      </button>
                      <button onClick={() => öppnaRedigera(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Redigera
                      </button>
                      <button onClick={() => setTaBort(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                        Ta bort
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {uppdFråga.isLoading && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">Laddar uppdateringar...</td></tr>
            )}
            {uppdFråga.isError && (
              <tr><td colSpan={5} className="p-0">
                <HamtningsFel
                  fel={uppdFråga.error}
                  reserv={uppdOkända ? 'Kunde inte hämta uppdateringarna. Det här är inte samma sak som att inga finns.' : 'Kunde inte uppdatera listan. Den kan vara inaktuell.'}
                  onForsokIgen={() => { void uppdFråga.refetch() }}
                  arIgang={uppdFråga.isFetching}
                  className="py-10"
                />
              </td></tr>
            )}
            {!uppdFråga.isLoading && !uppdOkända && filtrerade.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                  Inga uppdateringar matchar filtret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
