import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FaqKategori } from '../../types'
import { type FaqItem, fetchAdminFaq, createFaqItem, updateFaqItem, deleteFaqItem, type FaqRequest } from '../../api/faq'
import { FLAG_DEFINITIONER, type FlagKey } from '../../lib/featureFlags'
import { useFeatureFlagsAdmin } from '../../context/FeatureFlagsContext'

const KATEGORIER: FaqKategori[] = ['Notifieringar', 'Mina källor', 'Konto', 'Uppdateringar']

const KAT_FÄRG: Record<FaqKategori, string> = {
  'Notifieringar': 'bg-violet-100 text-violet-700 border-violet-200',
  'Mina källor':   'bg-blue-100 text-blue-700 border-blue-200',
  'Konto':         'bg-amber-100 text-amber-700 border-amber-200',
  'Uppdateringar': 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

// ---------------------------------------------------------------------------
// Ta bort-modal
// ---------------------------------------------------------------------------

function TaBortModal({ fråga, onBekräfta, onStäng }: {
  fråga: string; onBekräfta: () => void; onStäng: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <h2 className="text-lg font-bold text-white">Ta bort fråga</h2>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">"{fråga}"</strong> tas bort permanent. Åtgärden kan inte ångras.
          </p>
          <div className="flex gap-3">
            <button onClick={onStäng}      className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={onBekräfta}   className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">Ta bort</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulärpanel
// ---------------------------------------------------------------------------

function FormPanel({ redigerar, onSpara, onStäng }: {
  redigerar: FaqItem | null
  onSpara:   (fråga: string, svar: string, kategori: FaqKategori, flagKey: string | null) => void
  onStäng:   () => void
}) {
  const [fråga,    setFråga]    = useState(redigerar?.fraga    ?? '')
  const [svar,     setSvar]     = useState(redigerar?.svar     ?? '')
  const [kategori, setKategori] = useState<FaqKategori>(redigerar?.kategori ?? 'Notifieringar')
  const [flagKey,  setFlagKey]  = useState<string | null>(redigerar?.flagKey ?? null)

  const kanSpara = fråga.trim() !== '' && svar.trim() !== ''

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onStäng} />
      <div className="fixed top-0 right-0 bottom-0 z-40 w-[520px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {redigerar ? 'Redigera fråga' : 'Ny fråga'}
          </h2>
          <button onClick={onStäng} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Kategori */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kategori</label>
            <div className="flex gap-2 flex-wrap">
              {KATEGORIER.map(k => (
                <button
                  key={k}
                  onClick={() => setKategori(k)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                    kategori === k ? KAT_FÄRG[k] + ' border' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Fråga */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fråga</label>
            <input
              type="text"
              value={fråga}
              onChange={e => setFråga(e.target.value)}
              placeholder="T.ex. 'Varför fick jag ingen notis?'"
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Svar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Svar</label>
            <textarea
              value={svar}
              onChange={e => setSvar(e.target.value)}
              rows={5}
              placeholder="Beskriv svaret tydligt och kortfattat..."
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
            />
          </div>

          {/* Kopplad funktion */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kopplad funktion (valfritt)</label>
            <select
              value={flagKey ?? ''}
              onChange={e => setFlagKey(e.target.value || null)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white"
            >
              <option value="">Ingen koppling</option>
              {FLAG_DEFINITIONER.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">Om funktionen stängs av döljs frågan automatiskt för besökare, oavsett status nedan.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onStäng} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Avbryt
          </button>
          <button
            onClick={() => kanSpara && onSpara(fråga.trim(), svar.trim(), kategori, flagKey)}
            disabled={!kanSpara}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {redigerar ? 'Spara ändringar' : 'Skapa fråga'}
          </button>
        </div>

      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function AdminFaq() {
  const queryClient = useQueryClient()
  const { flaggor } = useFeatureFlagsAdmin()
  const { data: frågor = [] } = useQuery({
    queryKey: ['admin-faq'],
    queryFn:  fetchAdminFaq,
  })

  const [katFilter,   setKatFilter]   = useState<FaqKategori | 'alla'>('alla')
  const [sökning,     setSökning]     = useState('')
  const [panelÖppen,  setPanelÖppen]  = useState(false)
  const [redigerar,   setRedigerar]   = useState<FaqItem | null>(null)
  const [taBort,      setTaBort]      = useState<FaqItem | null>(null)

  function invalidera() {
    queryClient.invalidateQueries({ queryKey: ['admin-faq'] })
  }

  const createMutation = useMutation({ mutationFn: createFaqItem, onSuccess: invalidera })
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; req: FaqRequest }) => updateFaqItem(vars.id, vars.req),
    onSuccess:  invalidera,
  })
  const deleteMutation = useMutation({ mutationFn: deleteFaqItem, onSuccess: invalidera })

  const söktrim = sökning.trim().toLowerCase()

  const filtrerade = frågor.filter(f => {
    const katMatch = katFilter === 'alla' || f.kategori === katFilter
    const sökMatch = !söktrim || f.fraga.toLowerCase().includes(söktrim) || f.svar.toLowerCase().includes(söktrim)
    return katMatch && sökMatch
  })

  function öppnaSkapa()              { setRedigerar(null); setPanelÖppen(true) }
  function öppnaRedigera(f: FaqItem) { setRedigerar(f);     setPanelÖppen(true) }
  function stängPanel()              { setPanelÖppen(false); setRedigerar(null) }

  function spara(fråga: string, svar: string, kategori: FaqKategori, flagKey: string | null) {
    if (redigerar) {
      updateMutation.mutate({ id: redigerar.id, req: { kategori, fraga: fråga, svar, publicerad: redigerar.publicerad, flagKey } })
    } else {
      createMutation.mutate({ kategori, fraga: fråga, svar, publicerad: true, flagKey })
    }
    stängPanel()
  }

  function togglePublicerad(f: FaqItem) {
    updateMutation.mutate({ id: f.id, req: { kategori: f.kategori, fraga: f.fraga, svar: f.svar, publicerad: !f.publicerad, flagKey: f.flagKey } })
  }

  function flaggaÄrAv(f: FaqItem): boolean {
    return !!f.flagKey && !flaggor[f.flagKey as FlagKey]
  }

  const antal = {
    totalt:        frågor.length,
    publicerade:   frågor.filter(f => f.publicerad).length,
    notifieringar: frågor.filter(f => f.kategori === 'Notifieringar').length,
    kallor:        frågor.filter(f => f.kategori === 'Mina källor').length,
    konto:         frågor.filter(f => f.kategori === 'Konto').length,
    uppdateringar: frågor.filter(f => f.kategori === 'Uppdateringar').length,
  }

  return (
    <div className="flex flex-col gap-6">

      {taBort && (
        <TaBortModal
          fråga={taBort.fraga}
          onBekräfta={() => { deleteMutation.mutate(taBort.id); setTaBort(null) }}
          onStäng={() => setTaBort(null)}
        />
      )}

      {panelÖppen && (
        <FormPanel redigerar={redigerar} onSpara={spara} onStäng={stängPanel} />
      )}

      {/* Stat-kort */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Totalt',        värde: antal.totalt,        färg: 'text-slate-800' },
          { label: 'Publicerade',   värde: antal.publicerade,   färg: 'text-green-600' },
          { label: 'Notifieringar', värde: antal.notifieringar, färg: 'text-violet-600' },
          { label: 'Mina källor',   värde: antal.kallor,        färg: 'text-blue-600'   },
          { label: 'Konto',         värde: antal.konto,         färg: 'text-amber-600'  },
          { label: 'Uppdateringar', värde: antal.uppdateringar, färg: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
            <p className={`text-3xl font-bold ${s.färg}`}>{s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Verktygsfält */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">

          {/* Kategorifiltrar */}
          <div className="flex gap-1 flex-wrap">
            {(['alla', ...KATEGORIER] as (FaqKategori | 'alla')[]).map(k => (
              <button
                key={k}
                onClick={() => setKatFilter(k)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  katFilter === k
                    ? k === 'alla' ? 'bg-violet-100 text-violet-700' : KAT_FÄRG[k as FaqKategori] + ' border'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {k === 'alla' ? 'Alla kategorier' : k}
              </button>
            ))}
          </div>

          {/* Sök */}
          <div className="relative ml-auto">
            <input
              type="text"
              value={sökning}
              onChange={e => setSökning(e.target.value)}
              placeholder="Sök fråga eller svar…"
              className="pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent w-56"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
            {sökning && (
              <button onClick={() => setSökning('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
            )}
          </div>

          <button
            onClick={öppnaSkapa}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0"
          >
            + Ny fråga
          </button>
        </div>

        {/* Tabell */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Fråga</th>
              <th className="text-left px-4 py-3 font-medium">Svar</th>
              <th className="text-left px-4 py-3 font-medium">Kategori</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map(f => (
              <tr key={f.id} className={`transition-colors ${f.publicerad ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-60 hover:opacity-80'}`}>
                <td className="px-6 py-3 w-64">
                  <p className="font-medium text-slate-800 line-clamp-2">{f.fraga}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-500 line-clamp-2">{f.svar}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${KAT_FÄRG[f.kategori]}`}>
                    {f.kategori}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => togglePublicerad(f)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        f.publicerad
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {f.publicerad ? 'Publicerad' : 'Dold'}
                    </button>
                    {flaggaÄrAv(f) && (
                      <span
                        title={`Kopplad funktion (${f.flagKey}) är avstängd — frågan visas inte för besökare oavsett status ovan`}
                        className="text-xs font-semibold px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200"
                      >
                        ⚠️ Dold av flagga
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => öppnaRedigera(f)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={() => setTaBort(f)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Ta bort
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrerade.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">
                  {sökning ? <>Inga frågor matchade <strong className="text-slate-500">"{sökning}"</strong>.</> : 'Inga frågor i den här kategorin.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
