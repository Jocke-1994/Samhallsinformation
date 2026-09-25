import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type MaintenanceBanner, type BannerÅskådare, type MaintenanceBannerRequest,
  fetchAdminMaintenanceBanners, createMaintenanceBanner, updateMaintenanceBanner, deleteMaintenanceBanner,
} from '../../api/maintenanceBanners'
import { formatSvensktDatumTid, isoTillDatetimeLocal } from '../../lib/tid'

const ÅSKÅDARE: BannerÅskådare[] = ['Alla', 'Besökare', 'Användare']

const ÅSKÅDARE_BESKRIVNING: Record<BannerÅskådare, string> = {
  'Alla':      'Alla besökare, inloggade som utloggade',
  'Besökare':  'Bara utloggade besökare',
  'Användare': 'Bara inloggade användare',
}

// Enda standardtexten som finns idag — fler kan läggas till som egna
// funktioner + knappar i samma stil om fler mallar behövs.
function standardtextUnderhåll(start: string, slut: string): string {
  return `Planerat underhåll utförs mellan ${formatSvensktDatumTid(start)} och ${formatSvensktDatumTid(slut)}. Under denna tid kan sidan vara tillfälligt otillgänglig.`
}

function status(b: MaintenanceBanner): { text: string; färg: string } {
  const nu = Date.now()
  const start = new Date(b.startUtc).getTime()
  const slut = new Date(b.endUtc).getTime()
  if (nu < start) return { text: 'Kommande', färg: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (nu > slut)  return { text: 'Avslutat', färg: 'bg-slate-100 text-slate-500 border-slate-200' }
  return { text: 'Aktivt', färg: 'bg-green-50 text-green-700 border-green-200' }
}

// ---------------------------------------------------------------------------
// Ta bort-modal
// ---------------------------------------------------------------------------

function TaBortModal({ meddelande, onBekräfta, onStäng }: {
  meddelande: string; onBekräfta: () => void; onStäng: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <h2 className="text-lg font-bold text-white">Ta bort driftmeddelande</h2>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">"{meddelande}"</strong> tas bort permanent och slutar visas direkt.
          </p>
          <div className="flex gap-3">
            <button onClick={onStäng}    className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={onBekräfta} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">Ta bort</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulärmodal
// ---------------------------------------------------------------------------

function FormModal({ redigerar, onSpara, onStäng }: {
  redigerar: MaintenanceBanner | null
  onSpara:   (req: MaintenanceBannerRequest) => void
  onStäng:   () => void
}) {
  const [meddelande, setMeddelande] = useState(redigerar?.message ?? '')
  const [start, setStart]           = useState(redigerar ? isoTillDatetimeLocal(redigerar.startUtc) : '')
  const [slut, setSlut]             = useState(redigerar ? isoTillDatetimeLocal(redigerar.endUtc) : '')
  const [åskådare, setÅskådare]     = useState<BannerÅskådare>(redigerar?.audience ?? 'Alla')
  const [utcStart, setUtcStart]     = useState('')
  const [utcSlut, setUtcSlut]       = useState('')

  // Många leverantörers underhållsaviseringar (t.ex. Railway) anger UTC-tid.
  // De här två fälten är bara ett omvandlingshjälpmedel — de sparas inte,
  // de fyller bara i de riktiga lokala tid-fälten nedan.
  function utcTillLokalt(utcDatetimeLocal: string): string {
    if (!utcDatetimeLocal) return ''
    return isoTillDatetimeLocal(`${utcDatetimeLocal}:00Z`)
  }

  const kanSpara = meddelande.trim() !== '' && start !== '' && slut !== '' && new Date(slut) > new Date(start)
  const kanAnvändaStandardtext = start !== '' && slut !== '' && new Date(slut) > new Date(start)

  function spara() {
    if (!kanSpara) return
    onSpara({
      message: meddelande.trim(),
      startUtc: new Date(start).toISOString(),
      endUtc: new Date(slut).toISOString(),
      audience: åskådare,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {redigerar ? 'Redigera driftmeddelande' : 'Nytt driftmeddelande'}
          </h3>
          <button onClick={onStäng} className="text-slate-300 hover:text-slate-600 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Meddelande</label>
              <button
                type="button"
                onClick={() => setMeddelande(standardtextUnderhåll(start, slut))}
                disabled={!kanAnvändaStandardtext}
                title={kanAnvändaStandardtext ? undefined : 'Fyll i start och slut först'}
                className="text-xs font-medium text-violet-600 hover:text-violet-500 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                Använd standardtext (underhåll)
              </button>
            </div>
            <input
              type="text"
              value={meddelande}
              onChange={e => setMeddelande(e.target.value)}
              placeholder="Vi gör en planerad tjänsteuppdatering — sajten kan vara tillfälligt otillgänglig."
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl px-3 py-3 border border-slate-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">UTC-start (valfritt)</label>
              <input
                type="datetime-local"
                value={utcStart}
                onChange={e => { setUtcStart(e.target.value); setStart(utcTillLokalt(e.target.value)) }}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">UTC-slut (valfritt)</label>
              <input
                type="datetime-local"
                value={utcSlut}
                onChange={e => { setUtcSlut(e.target.value); setSlut(utcTillLokalt(e.target.value)) }}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white"
              />
            </div>
            <p className="col-span-2 text-xs text-slate-400">
              Fyll i om du har UTC-tider (t.ex. från Railway) — fälten nedan räknas om automatiskt till svensk tid.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Start (din lokala tid)</label>
              <input
                type="datetime-local"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Slut (din lokala tid)</label>
              <input
                type="datetime-local"
                value={slut}
                onChange={e => setSlut(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Målgrupp</label>
            <div className="flex flex-col gap-2">
              {ÅSKÅDARE.map(a => (
                <label key={a} className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input
                    type="radio"
                    checked={åskådare === a}
                    onChange={() => setÅskådare(a)}
                    className="accent-violet-600 w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">{a}</span>
                  <span className="text-xs text-slate-400">— {ÅSKÅDARE_BESKRIVNING[a]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onStäng} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Avbryt
          </button>
          <button
            onClick={spara}
            disabled={!kanSpara}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {redigerar ? 'Spara ändringar' : 'Skapa meddelande'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function MaintenanceBannerAdmin() {
  const queryClient = useQueryClient()
  const { data: banners = [] } = useQuery({
    queryKey: ['admin-maintenance-banners'],
    queryFn:  fetchAdminMaintenanceBanners,
  })

  const [panelÖppen, setPanelÖppen] = useState(false)
  const [redigerar,  setRedigerar]  = useState<MaintenanceBanner | null>(null)
  const [taBort,     setTaBort]     = useState<MaintenanceBanner | null>(null)

  function invalidera() {
    queryClient.invalidateQueries({ queryKey: ['admin-maintenance-banners'] })
    queryClient.invalidateQueries({ queryKey: ['maintenance-banners'] })
  }

  const createMutation = useMutation({ mutationFn: createMaintenanceBanner, onSuccess: invalidera })
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; req: MaintenanceBannerRequest }) => updateMaintenanceBanner(vars.id, vars.req),
    onSuccess:  invalidera,
  })
  const deleteMutation = useMutation({ mutationFn: deleteMaintenanceBanner, onSuccess: invalidera })

  function öppnaSkapa()                     { setRedigerar(null); setPanelÖppen(true) }
  function öppnaRedigera(b: MaintenanceBanner) { setRedigerar(b);    setPanelÖppen(true) }
  function stängPanel()                     { setPanelÖppen(false); setRedigerar(null) }

  function spara(req: MaintenanceBannerRequest) {
    if (redigerar) updateMutation.mutate({ id: redigerar.id, req })
    else            createMutation.mutate(req)
    stängPanel()
  }

  const sorterade = [...banners].sort((a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime())

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {taBort && (
        <TaBortModal
          meddelande={taBort.message}
          onBekräfta={() => { deleteMutation.mutate(taBort.id); setTaBort(null) }}
          onStäng={() => setTaBort(null)}
        />
      )}
      {panelÖppen && (
        <FormModal redigerar={redigerar} onSpara={spara} onStäng={stängPanel} />
      )}

      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            Driftmeddelanden
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Banderoller för planerade drifttillfällen (t.ex. Railway-underhåll). Flera kan vara
            aktiva samtidigt, riktade mot olika målgrupper. Visas/döljs automatiskt utifrån tiderna.
          </p>
        </div>
        <button
          onClick={öppnaSkapa}
          className="text-sm font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0"
        >
          + Nytt meddelande
        </button>
      </div>

      {sorterade.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-400">Inga driftmeddelanden skapade.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {sorterade.map(b => {
            const s = status(b)
            return (
              <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 truncate">{b.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatSvensktDatumTid(b.startUtc)} – {formatSvensktDatumTid(b.endUtc)} · {b.audience}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${s.färg}`}>
                  {s.text}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => öppnaRedigera(b)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Redigera
                  </button>
                  <button
                    onClick={() => setTaBort(b)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
