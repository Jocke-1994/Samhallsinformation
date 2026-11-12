import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FaqKategori } from '../../../types'
import { fetchFaq } from '../../../api/faq'
import { useFlags } from '../../../context/FeatureFlagsContext'
import { isSektionSynlig, type FlagKey } from '../../../lib/featureFlags'

const FAQ_KATEGORIER: FaqKategori[] = ['Notifieringar', 'Mina källor', 'Konto', 'Uppdateringar']

// Kopplar en FAQ-kategori till dess sektion i featureFlags.ts, så en flik
// döljs om ingen flagga i den sektionen är aktiv — samma mönster som
// ProfileLanding/Sidebar redan använder för själva profilsektionerna.
const KATEGORI_SEKTION: Record<FaqKategori, string> = {
  Notifieringar: 'notifieringar',
  'Mina källor': 'mina-kallor',
  Konto: 'konto',
  Uppdateringar: 'uppdateringar',
}

export default function FaqKort() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [aktivKategori, setAktivKategori] = useState<FaqKategori | 'alla'>('alla')
  const [sökning, setSökning] = useState('')
  const flaggor = useFlags()

  const synligaKategorier = FAQ_KATEGORIER.filter((kat) =>
    isSektionSynlig(KATEGORI_SEKTION[kat], flaggor),
  )

  const { data: hämtade = [] } = useQuery({
    queryKey: ['faq'],
    queryFn: fetchFaq,
  })

  // En fråga kopplad till en avstängd flagga döljs helt, oavsett Publicerad —
  // annars ligger t.ex. en beskrivning av en funktion kvar synlig efter att
  // funktionen själv stängts av (hände med de gamla mail/SMS-FAQ-posterna).
  const publicerade = hämtade.filter((item) => !item.flagKey || flaggor[item.flagKey as FlagKey])

  const söktrim = sökning.trim().toLowerCase()

  const visade = publicerade.filter((item) => {
    const katMatch = aktivKategori === 'alla' || item.kategori === aktivKategori
    const sökMatch =
      !söktrim ||
      item.fraga.toLowerCase().includes(söktrim) ||
      item.svar.toLowerCase().includes(söktrim)
    return katMatch && sökMatch
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 text-center">Vanliga frågor</h2>
        <p className="text-sm text-slate-400 mt-0.5 text-center">
          Snabbsvar på de vanligaste frågorna
        </p>
        <div className="relative mt-3">
          <input
            type="text"
            value={sökning}
            onChange={(e) => {
              setSökning(e.target.value)
              setOpenIndex(null)
            }}
            placeholder="Sök bland frågorna…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            🔍
          </span>
          {sökning && (
            <button
              onClick={() => setSökning('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filterflikar — en kategori döljs om ingen feature-flag i den sektionen är aktiv.
          auto-fit/minmax istället för fasta grid-cols-N: antalet flikar varierar
          med hur många sektioner som är aktiva, så kolumnantalet måste anpassa sig
          (fasta Tailwind-klasser som grid-cols-${n} skulle inte fungera här —
          Tailwinds JIT-scanner hittar bara statiskt skrivna klassnamn). */}
      <div
        className="grid gap-2 px-4 pt-4 pb-3 border-b border-slate-100"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}
      >
        {(['alla', ...synligaKategorier] as (FaqKategori | 'alla')[]).map((kat) => {
          const count =
            kat === 'alla'
              ? publicerade.length
              : publicerade.filter((i) => i.kategori === kat).length
          const isActive = aktivKategori === kat
          const activeStyles: Record<string, string> = {
            alla: 'bg-slate-800 text-white',
            Notifieringar: 'bg-violet-500 text-white',
            'Mina källor': 'bg-blue-500 text-white',
            Konto: 'bg-amber-400 text-white',
            Uppdateringar: 'bg-emerald-500 text-white',
          }
          return (
            <button
              key={kat}
              onClick={() => {
                setAktivKategori(kat)
                setOpenIndex(null)
              }}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
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
              <span className="text-sm font-medium text-slate-700">{item.fraga}</span>
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
