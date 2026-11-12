import { useState } from 'react'
import Banderoll from '../common/Banderoll'
import { VadArNyttInnehall } from '../common/VadArNytt'
import SenasteUppdateringKort from '../Uppdateringar/SenasteUppdateringKort'
import {
  banderoll,
  checklista,
  punkterNyhetersidan,
  punkterProfilen,
  punkterVadÄrNytt,
  push,
  type Fas,
  type FörhandsData,
  type VisaSom,
} from '../../lib/uppdateringForhandsvisning'

type Flik = 'nyheter' | 'profil' | 'vadarnytt' | 'banderoll' | 'push'

// Live-förhandsvisning bredvid Uppdateringar-formuläret (Ideer/Uppdateringar-
// forhandsvisning.md, skiss godkänd 2026-11-02). Visar sajtens RIKTIGA
// komponenter (Nyheter-kortet, Vad är nytt, Banderoll) med formulärets
// osparade värden. Syns alltid på dator, inte på mobil (beslut 2026-11-02).
export default function UppdateringForhandsvisning({ data }: { data: FörhandsData }) {
  const [valdFlik, setFlik] = useState<Flik>('nyheter')
  const [som, setSom] = useState<VisaSom>('besokare')
  const [valdFas, setFas] = useState<Fas>('lansering')

  const harAnnonsering = data.schemalagd && data.annonsera
  const fas: Fas = harAnnonsering ? valdFas : 'lansering'

  const flikar: [Flik, string][] = [
    ['nyheter', 'Nyheter-sidan'],
    ['profil', 'Profil'],
    ...(data.visaVadArNytt ? [['vadarnytt', 'Vad är nytt'] as [Flik, string]] : []),
    ...(data.schemalagd && data.visaBanderoll
      ? [['banderoll', 'Banderoll'] as [Flik, string]]
      : []),
    ...(data.schemalagd && data.skickaPush ? [['push', 'Push'] as [Flik, string]] : []),
  ]
  const flik = flikar.some(([k]) => k === valdFlik) ? valdFlik : 'nyheter'
  const lista = checklista(data)

  return (
    <div className="flex flex-col h-full">
      <div
        role="tablist"
        aria-label="Förhandsvisning"
        className="flex gap-1 px-4 pt-3 border-b border-slate-200 overflow-x-auto shrink-0"
      >
        {flikar.map(([k, namn]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={flik === k}
            onClick={() => setFlik(k)}
            className={`text-sm font-medium px-3 py-2 border-b-2 -mb-px whitespace-nowrap transition-colors ${
              flik === k
                ? 'border-violet-600 text-violet-700 dark:text-violet-300 dark:border-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {namn}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 border-b border-slate-100 text-xs text-slate-500 shrink-0">
        <Växel
          etikett="Visa som"
          värde={som}
          onChange={setSom}
          val={[
            ['besokare', 'Besökare'],
            ['inloggad', 'Inloggad'],
          ]}
        />
        {harAnnonsering && (
          <Växel
            etikett="Fas"
            värde={fas}
            onChange={setFas}
            val={[
              ['annonsering', 'Annonsering'],
              ['lansering', 'Lansering'],
            ]}
          />
        )}
      </div>

      {/* Överst: syns direkt och skyms inte av kundtjänstbubblan i nedre hörnet. */}
      <div className="border-b border-slate-200 px-4 py-3 shrink-0 max-h-48 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Innan du publicerar
        </p>
        <ul className="flex flex-col gap-1.5" aria-label="Innan du publicerar">
          {lista.map((p) => (
            <li
              key={p.text}
              className={`text-xs leading-snug rounded-lg px-2.5 py-1.5 ${
                p.nivå === 'varning'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : p.nivå === 'info'
                    ? 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {p.nivå === 'varning' ? '⚠️ ' : p.nivå === 'info' ? 'ℹ️ ' : '✅ '}
              {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div
        role="tabpanel"
        className="flex-1 overflow-y-auto bg-slate-50 px-5 py-6 flex flex-col items-center gap-3"
      >
        {flik === 'nyheter' && <NyheterVy data={data} fas={fas} som={som} />}
        {flik === 'profil' && <ProfilVy data={data} fas={fas} som={som} />}
        {flik === 'vadarnytt' && <VadÄrNyttVy data={data} fas={fas} som={som} />}
        {flik === 'banderoll' && <BanderollVy data={data} fas={fas} som={som} />}
        {flik === 'push' && <PushVy data={data} fas={fas} som={som} />}
      </div>
    </div>
  )
}

function Växel<T extends string>({
  etikett,
  värde,
  onChange,
  val,
}: {
  etikett: string
  värde: T
  onChange: (v: T) => void
  val: [T, string][]
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={etikett}>
      <span>{etikett}</span>
      {val.map(([v, namn]) => (
        <button
          key={v}
          type="button"
          aria-pressed={värde === v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-0.5 rounded-full border font-medium transition-colors ${
            värde === v
              ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-600 dark:border-slate-500'
              : 'border-slate-200 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {namn}
        </button>
      ))}
    </div>
  )
}

interface VyProps {
  data: FörhandsData
  fas: Fas
  som: VisaSom
}

function Förklaring({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 text-center max-w-md leading-relaxed">{children}</p>
}

function Tomt({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-md text-center dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
      {children}
    </p>
  )
}

const iso = (yyyyMmDd: string) => (yyyyMmDd ? `${yyyyMmDd}T00:00:00` : new Date().toISOString())

function NyheterVy({ data, fas, som }: VyProps) {
  const ps = punkterNyhetersidan(data, fas)
  return (
    <>
      {ps.length === 0 ? (
        <Tomt>
          Uppdateringen syns inte på Nyheter-sidan: ingen ifylld punkt är märkt "Alla (även
          besökare)".
        </Tomt>
      ) : (
        <div className="w-full max-w-xl">
          <SenasteUppdateringKort
            titel={data.titel || '(ingen titel)'}
            datum={iso(data.datum)}
            punkter={ps}
            version={data.version}
            förhandsvisning={{
              inloggad: som === 'inloggad',
              flaggor: data.flaggorEfterLansering ?? {},
            }}
          />
        </div>
      )}
      <Förklaring>
        {som === 'inloggad'
          ? 'Nyheter-sidan visar bara punkter märkta "Alla", även för inloggade. '
          : ''}
        {data.schemalagd
          ? `Syns från ${fas === 'annonsering' ? 'annonseringen' : 'lanseringen'}.`
          : 'Syns när du publicerar.'}
      </Förklaring>
    </>
  )
}

function ProfilVy({ data, fas, som }: VyProps) {
  if (som === 'besokare')
    return <Tomt>Profilen finns bara för inloggade. Byt till "Inloggad" ovan.</Tomt>
  if (!data.profilUppdateringarPå)
    return (
      <Tomt>
        Profil → Uppdateringar är avstängd för användarna. Välj flaggan uppdateringar_senaste i
        lanseringen, annars syns inget här.
      </Tomt>
    )
  const ps = punkterProfilen(data, fas)
  if (ps.length === 0) return <Tomt>Inga ifyllda punkter än.</Tomt>
  return (
    <>
      <div className="w-full max-w-xl">
        <SenasteUppdateringKort
          titel={data.titel || '(ingen titel)'}
          datum={iso(data.datum)}
          punkter={ps}
          version={data.version}
          className=""
          härifrån="profil-uppdateringar"
          förhandsvisning={{ inloggad: true, flaggor: data.flaggorEfterLansering ?? {} }}
        />
      </div>
      <Förklaring>
        Inloggade ser alla punkter här, även de som är "Endast inloggade".
        {data.schemalagd
          ? ` Syns från ${fas === 'annonsering' ? 'annonseringen' : 'lanseringen'}.`
          : ' Syns när du publicerar.'}
      </Förklaring>
    </>
  )
}

function VadÄrNyttVy({ data, fas, som }: VyProps) {
  if (som === 'besokare')
    return <Tomt>Vad är nytt visas bara för inloggade. Byt till "Inloggad" ovan.</Tomt>
  if (fas === 'annonsering')
    return (
      <Tomt>
        Rutan visas inte under annonseringen, bara från lanseringen, så att innehållet inte avslöjas
        i förväg.
      </Tomt>
    )
  const ps = punkterVadÄrNytt(data)
  return (
    <>
      <div className="relative w-[360px] max-w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-5">
        <VadArNyttInnehall
          titel={data.titel || '(ingen titel)'}
          datum={iso(data.datum)}
          punkter={ps}
          version={data.version}
          onStäng={() => {}}
          förhandsvisning={{ flaggor: data.flaggorEfterLansering ?? {} }}
        />
      </div>
      <Förklaring>
        Kort i nedre högra hörnet på dator, ark från botten på mobil. Visas en gång per konto.
      </Förklaring>
    </>
  )
}

function BanderollVy({ data, fas, som }: VyProps) {
  const b = banderoll(data, fas, som)
  if (!b)
    return (
      <Tomt>
        {som === 'besokare'
          ? 'Besökare ser ingen banderoll: alla punkter är "Endast inloggade", så den visas bara för inloggade.'
          : 'Ingen banderoll: fyll i minst en punkt.'}
      </Tomt>
    )
  return (
    <>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden border border-slate-200 bg-white">
        <Banderoll banner={b} förhandsvisning />
        <div className="p-4 flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
      <Förklaring>
        Visas för {b.audience === 'Alla' ? 'alla (även besökare)' : 'bara inloggade'}, härlett från
        punkternas "Syns för".{' '}
        {fas === 'annonsering' ? 'Försvinner vid lanseringen.' : 'Ligger kvar i 7 dagar.'}
      </Förklaring>
    </>
  )
}

function PushVy({ data, fas, som }: VyProps) {
  if (som === 'besokare')
    return (
      <Tomt>
        Push går bara till inloggade med "Ny version"-notiser på. Byt till "Inloggad" ovan.
      </Tomt>
    )
  const p = push(data, fas)
  if (!p)
    return <Tomt>Ingen push i den här fasen ("Skicka vid" är satt till {data.pushSkickaVid}).</Tomt>
  const tid = new Date(fas === 'annonsering' ? data.annonseDatum : data.schemaDatum)
  return (
    <>
      <div className="w-[300px] max-w-full bg-slate-900 rounded-[2rem] px-3.5 pt-10 pb-14 shadow-xl">
        <p className="text-white text-center text-4xl font-light mb-6 tabular-nums">
          {Number.isNaN(tid.getTime())
            ? '08:00'
            : tid.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="bg-slate-800 rounded-2xl px-3.5 py-3 flex gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400 flex justify-between">
              <span>Samhällsinformation</span>
              <span>nu</span>
            </p>
            <p className="text-sm font-semibold text-white mt-0.5 break-words">{p.titel}</p>
            <p className="text-[13px] text-slate-300 leading-snug break-words">{p.text}</p>
          </div>
        </div>
      </div>
      <Förklaring>
        Utseendet skiljer sig mellan telefoner — texten är exakt den som skickas.
      </Förklaring>
    </>
  )
}
