import { useState } from 'react'
import type { FaqKategori } from '../../../types'
import { laddaFaq } from '../../../lib/faqStorage'

const FAQ_KATEGORIER: FaqKategori[] = ['Notifieringar', 'Mina källor', 'Konto', 'Uppdateringar']

export default function FaqKort() {
  const [openIndex, setOpenIndex]         = useState<number | null>(null)
  const [aktivKategori, setAktivKategori] = useState<FaqKategori | 'alla'>('alla')
  const [sökning, setSökning]             = useState('')

  const publicerade = laddaFaq().filter(f => f.publicerad)

  const söktrim = sökning.trim().toLowerCase()

  const visade = publicerade.filter(item => {
    const katMatch = aktivKategori === 'alla' || item.kategori === aktivKategori
    const sökMatch = !söktrim || item.fråga.toLowerCase().includes(söktrim) || item.svar.toLowerCase().includes(söktrim)
    return katMatch && sökMatch
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 text-center">Vanliga frågor</h2>
        <p className="text-sm text-slate-400 mt-0.5 text-center">Snabbsvar på de vanligaste frågorna</p>
        <div className="relative mt-3">
          <input
            type="text"
            value={sökning}
            onChange={e => { setSökning(e.target.value); setOpenIndex(null) }}
            placeholder="Sök bland frågorna…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          {sökning && (
            <button
              onClick={() => setSökning('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs leading-none"
            >✕</button>
          )}
        </div>
      </div>

      {/* Filterflikar */}
      <div className="flex border-b border-slate-100">
        {(['alla', ...FAQ_KATEGORIER] as (FaqKategori | 'alla')[]).map(kat => {
          const count = kat === 'alla' ? publicerade.length : publicerade.filter(i => i.kategori === kat).length
          const isActive = aktivKategori === kat
          const activeStyles: Record<string, string> = {
            'alla':          'bg-slate-800 text-white',
            'Notifieringar': 'bg-violet-500 text-white',
            'Mina källor':   'bg-blue-500 text-white',
            'Konto':         'bg-amber-400 text-white',
            'Uppdateringar': 'bg-emerald-500 text-white',
          }
          return (
            <button
              key={kat}
              onClick={() => { setAktivKategori(kat); setOpenIndex(null) }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? activeStyles[kat]
                  : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="block">{kat === 'alla' ? 'Alla' : kat}</span>
              <span className="block text-[11px] mt-0.5 opacity-80">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-slate-100">
        {visade.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            Inga frågor matchade <strong className="text-slate-500">"{sökning}"</strong>.
          </div>
        )}
        {visade.map((item, i) => (
          <div key={`${aktivKategori}-${i}`}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-start justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors gap-4"
            >
              <span className="text-sm font-medium text-slate-700">{item.fråga}</span>
              <span className="text-slate-400 shrink-0">{openIndex === i ? '−' : '+'}</span>
            </button>
            {openIndex === i && (
              <div className="px-6 pb-4">
                <p className="text-sm text-slate-500 leading-relaxed">{item.svar}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
