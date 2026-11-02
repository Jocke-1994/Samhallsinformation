import type { UppdateringsPunkt } from '../../api/uppdateringar'
import { getTypConfig } from '../../lib/uppdateringTyp'
import type { FlagState } from '../../lib/featureFlags'
import type { ProvaSjalvMål } from '../../lib/provaSjalv'
import ProvaSjalvLank from '../common/ProvaSjalvLank'

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Det framhävda "Senaste"-kortet på Nyheter-sidan (/uppdateringar) och i
// Profil → Uppdateringar. Egen komponent så att förhandsvisningen i admin
// (UppdateringForhandsvisning) visar EXAKT samma sak som användarna ser, inte
// en kopia som kan glida isär (profilen hade en egen kopia fram till 2026-11-02).
export default function SenasteUppdateringKort({ titel, datum, punkter, className = 'mb-6', härifrån, förhandsvisning }: {
  titel: string
  datum: string
  punkter: UppdateringsPunkt[]
  className?: string
  /** Sidan kortet visas på — en Prova själv-länk dit döljs. */
  härifrån?: ProvaSjalvMål
  /** Admins förhandsvisning: länkarna visas som för den valda vyn och navigerar inte. */
  förhandsvisning?: { inloggad: boolean; flaggor: Partial<FlagState> }
}) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden ${className}`}>
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-8 py-6 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Senaste</span>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">{titel}</h2>
          <p className="text-violet-200 text-sm mt-1">{formatDatum(datum)}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
          🚀
        </div>
      </div>
      <div className="px-8 py-5 flex flex-col gap-3">
        {punkter.map(p => {
          const cfg = getTypConfig(p.typ)
          return (
            <div key={p.id} className="flex items-start gap-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                {cfg.label}
              </span>
              <div className="flex flex-col">
                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{p.text}</span>
                <ProvaSjalvLank mål={p.provaSjalv} härifrån={härifrån} förhandsvisning={förhandsvisning} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
