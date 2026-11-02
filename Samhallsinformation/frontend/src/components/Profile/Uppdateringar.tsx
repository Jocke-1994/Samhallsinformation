import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { KändBugg, KommandeVersion } from '../../types'
import { useFlags } from '../../context/FeatureFlagsContext'
import { fetchUppdateringar, uppdateringarQueryKey } from '../../api/uppdateringar'
import { useAuth } from '../../context/AuthContext'
import { getTypConfig } from '../../lib/uppdateringTyp'

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

const KANDA_BUGGAR: KändBugg[] = [
  {
    text: 'Nyhetsflödet laddas inte alltid om automatiskt när du byter källa.',
    allvar: 'låg',
    workaround: 'Klicka på källan en extra gång så uppdateras flödet.',
  },
  {
    text: 'SMHI-varningar visas bara när aktiva varningar utfärdats — inga händelser visas vid lugnt väder.',
    allvar: 'låg',
    workaround: 'Det är korrekt beteende. SMHI:s API returnerar tom lista när inga varningar är aktiva.',
  },
]

const PA_GANG: KommandeVersion | null = {
  version: '0.6.0',
  description: 'Personliga konton med källprenumerationer och anpassade notifieringar.',
  plannedDate: 'Höst 2026',
}


const ALLVAR_CONFIG: Record<KändBugg['allvar'], { bar: string; bg: string; label: string; labelColor: string }> = {
  låg:   { bar: 'bg-slate-300', bg: 'bg-slate-50 border-slate-200',  label: 'Låg prioritet',   labelColor: 'text-slate-500' },
  medel: { bar: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200',  label: 'Medel prioritet', labelColor: 'text-amber-700' },
  hög:   { bar: 'bg-red-500',   bg: 'bg-red-50 border-red-200',      label: 'Hög prioritet',   labelColor: 'text-red-600'   },
}

export default function Uppdateringar() {
  const flaggor = useFlags()
  const { isLoggedIn } = useAuth()
  const { data: uppdateringar = [] } = useQuery({
    queryKey: uppdateringarQueryKey(isLoggedIn),
    queryFn:  fetchUppdateringar,
  })
  const [latest, ...historik] = uppdateringar
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [buggFilter, setBuggFilter] = useState<KändBugg['allvar'] | 'alla'>('alla')

  function toggleVersion(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const kortSenaste = flaggor.uppdateringar_senaste && latest ? (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-between gap-4" style={{ padding: '1.5rem 2rem' }}>
        <div>
          <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Senaste</span>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">{latest.titel}</h2>
          <p className="text-violet-200 text-sm mt-1">{formatDatum(latest.datum)}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
          🚀
        </div>
      </div>
      <div style={{ padding: '1.25rem 2rem' }} className="flex flex-col gap-2.5">
        {latest.punkter.map(p => {
          const cfg = getTypConfig(p.typ)
          return (
            <div key={p.id} className="flex items-start gap-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">{p.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  ) : null

  const kortPagang = flaggor.uppdateringar_pagang ? (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">🔭</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Påväg</h2>
            <p className="text-sm text-slate-500 mt-0.5">Nästa planerade version</p>
          </div>
        </div>
      </div>
      <div style={{ padding: '1.25rem 2.5rem' }}>
        {PA_GANG ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900">v{PA_GANG.version}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {PA_GANG.plannedDate}
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mt-1">{PA_GANG.description}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">Ingen kommande version planerad just nu.</p>
        )}
      </div>
    </div>
  ) : null

  const kortKanda = flaggor.uppdateringar_kanda_problem ? (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🐛</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kända problem</h2>
            <p className="text-sm text-slate-500 mt-0.5">Vi arbetar på att lösa dessa</p>
          </div>
        </div>
      </div>
      {KANDA_BUGGAR.length > 0 && (
        <div style={{ padding: '0.75rem 2.5rem 0' }} className="flex gap-2 border-b border-slate-100">
          {(['alla', ...(['hög', 'medel', 'låg'] as KändBugg['allvar'][]).filter(
            lvl => KANDA_BUGGAR.some(b => b.allvar === lvl)
          )] as (KändBugg['allvar'] | 'alla')[]).map(filter => {
            const count = filter === 'alla' ? KANDA_BUGGAR.length : KANDA_BUGGAR.filter(b => b.allvar === filter).length
            const isActive = buggFilter === filter
            const activeStyle: Record<string, string> = {
              alla: 'bg-violet-100 text-violet-700 border-violet-200',
              hög:  'bg-red-100 text-red-700 border-red-200',
              medel:'bg-amber-100 text-amber-700 border-amber-200',
              låg:  'bg-slate-100 text-slate-600 border-slate-200',
            }
            const labelMap: Record<string, string> = { alla: 'Alla', hög: 'Hög', medel: 'Medel', låg: 'Låg' }
            return (
              <button
                key={filter}
                onClick={() => setBuggFilter(filter)}
                style={{ marginBottom: '-1px' }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-t-lg border transition-colors ${
                  isActive ? activeStyle[filter] : 'bg-white text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {labelMap[filter]} {count}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ padding: '1rem 2.5rem', maxHeight: '22rem', overflowY: 'auto' }} className="flex flex-col gap-3">
        {KANDA_BUGGAR.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">Inga kända problem just nu.</p>
        ) : KANDA_BUGGAR.filter(b => buggFilter === 'alla' || b.allvar === buggFilter).map((bugg, i) => {
          const cfg = ALLVAR_CONFIG[bugg.allvar]
          return (
            <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3.5 ${cfg.bg}`}>
              <div className={`w-1 rounded-full shrink-0 self-stretch ${cfg.bar}`} />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.labelColor}`}>
                    {cfg.label}
                  </span>
                  {bugg.status && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      {bugg.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{bugg.text}</p>
                {bugg.workaround && (
                  <div className="flex items-start gap-2 mt-1 bg-white rounded-lg px-3 py-2 border border-slate-200">
                    <span className="text-sm shrink-0">💡</span>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Lösning:</span> {bugg.workaround}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ) : null

  const kortHistorik = flaggor.uppdateringar_historik ? (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">📋</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Versionshistorik</h2>
            <p className="text-sm text-slate-500 mt-0.5">Alla tidigare uppdateringar</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {historik.map(release => {
          const isOpen = expanded.has(release.id)
          return (
            <div key={release.id}>
              <button
                onClick={() => toggleVersion(release.id)}
                style={{ padding: '1rem 2.5rem' }}
                className="w-full flex items-start justify-between hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-base font-bold text-slate-900">{release.titel}</span>
                    <span className="text-xs text-slate-400 font-medium">{formatDatum(release.datum)}</span>
                  </div>
                  {/* En etikett per TYP (Nytt, Fixat …), inte en per rad. Tidigare
                      visades radens plats ("Allmänt Allmänt"), som inte sa något. */}
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(release.punkter.map(p => p.typ))].map(typ => {
                      const cfg = getTypConfig(typ)
                      return (
                        <span key={typ} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <span className="text-slate-400 text-sm mt-1 shrink-0">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 2.5rem 1.25rem' }} className="flex flex-col gap-2">
                  {release.punkter.map(p => {
                    const cfg = getTypConfig(p.typ)
                    return (
                      <div key={p.id} className="flex items-start gap-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className="text-sm text-slate-600 leading-relaxed">{p.text}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  ) : null

  const synligaKort = [kortSenaste, kortPagang, kortKanda, kortHistorik].filter(Boolean)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {synligaKort.map((kort, i) => (
        <div key={i}>{kort}</div>
      ))}
    </div>
  )
}
