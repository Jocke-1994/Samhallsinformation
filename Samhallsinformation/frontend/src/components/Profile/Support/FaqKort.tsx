import { useState } from 'react'
import type { FaqItem, FaqKategori } from '../../../types'

const FAQ_ITEMS: (FaqItem & { publicerad: boolean })[] = [
  { kategori: 'Notifieringar', publicerad: true, q: 'Varför fick jag ingen notis?', a: 'Kontrollera att rätt kanal (mail/SMS) är aktiverad under Notifieringar och att källan är tillagd under Mina källor. Det kan ta upp till 5 minuter innan en ny händelse når dig.' },
  { kategori: 'Notifieringar', publicerad: true, q: 'Hur ändrar jag mitt SMS-nummer?', a: 'Gå till Notifieringar → Standardinställningar. Där visas ditt registrerade nummer och du kan uppdatera det.' },
  { kategori: 'Notifieringar', publicerad: true, q: 'Kan jag pausa notiser tillfälligt?', a: 'Ja, avmarkera Mail och SMS i Standardinställningar under Notifieringar. Dina inställningar sparas och kan aktiveras igen när du vill.' },
  { kategori: 'Mina källor',   publicerad: true, q: 'Hur lägger jag till fler källor?', a: 'Gå till Mina källor i profilmenyn. Där kan du söka efter myndigheter eller hämta förslag automatiskt via SPAR.' },
  { kategori: 'Mina källor',   publicerad: true, q: 'Kan jag följa flera myndigheter samtidigt?', a: 'Ja, du kan lägga till hur många källor du vill. Alla visas i ditt nyhetsflöde och du kan välja vilka du vill få notiser från.' },
  { kategori: 'Konto',         publicerad: true, q: 'Hur tar jag bort mitt konto?', a: 'Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras.' },
  { kategori: 'Konto',         publicerad: true, q: 'Hur laddar jag ner min data?', a: 'Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20).' },
  { kategori: 'Uppdateringar', publicerad: true, q: 'Hur ser jag vad som är nytt i senaste versionen?', a: 'Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar med direktlänkar till berörda funktioner.' },
  { kategori: 'Uppdateringar', publicerad: true, q: 'Hur rapporterar jag ett fel?', a: 'Skapa ett nytt ärende via formuläret längre ner på den här sidan. Välj "Tekniskt fel på sidan" som ämne och beskriv vad som hänt.' },
]

const PUBLICERADE_FAQ = FAQ_ITEMS.filter(i => i.publicerad)

const FAQ_KATEGORIER: FaqKategori[] = ['Notifieringar', 'Mina källor', 'Konto', 'Uppdateringar']

export default function FaqKort() {
  const [openIndex, setOpenIndex]       = useState<number | null>(null)
  const [aktivKategori, setAktivKategori] = useState<FaqKategori | 'alla'>('alla')
  const [sökning, setSökning]           = useState('')

  const söktrim = sökning.trim().toLowerCase()

  const visade = PUBLICERADE_FAQ.filter(item => {
    const katMatch = aktivKategori === 'alla' || item.kategori === aktivKategori
    const sökMatch = !söktrim || item.q.toLowerCase().includes(söktrim) || item.a.toLowerCase().includes(söktrim)
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
          const count = kat === 'alla' ? PUBLICERADE_FAQ.length : PUBLICERADE_FAQ.filter(i => i.kategori === kat).length
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
              <span className="text-sm font-medium text-slate-700">{item.q}</span>
              <span className="text-slate-400 shrink-0">{openIndex === i ? '−' : '+'}</span>
            </button>
            {openIndex === i && (
              <div className="px-6 pb-4">
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
