import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import Sidebar from '../components/Sidebar/Sidebar'

interface Change {
  type: 'nytt' | 'förbättrat' | 'fixat'
  text: string
}

interface Update {
  title: string
  date: string
  changes: Change[]
}

const UPDATES: Update[] = [
  {
    title: 'Tjänsten är live',
    date: 'Juni 2026',
    changes: [
      { type: 'nytt',       text: 'samhallsinformation.se är nu tillgänglig för alla' },
      { type: 'nytt',       text: 'Händelser och nyheter från Polisen och Krisinformation i ett samlat flöde under Samhällsinfo' },
      { type: 'nytt',       text: 'Filtrera flödet per källa via sidomenyn' },
      { type: 'nytt',       text: 'Fyra teman att välja mellan: mörkt, ljust, true black och dune, dessa ligger längst ner i sidomenyn' },
      { type: 'nytt',       text: 'Knappen "Om" förklara tjänstens funktioner och mål' },
      { type: 'nytt',       text: 'En Feedback-knapp för att ge återkoppling om tjänsten' },
      { type: 'förbättrat', text: 'Stabilitet och förbättringar' },
    ],
  },
]

const TYPE_CONFIG: Record<Change['type'], { label: string; pill: string }> = {
  nytt:       { label: 'Nytt',       pill: 'bg-violet-100 text-violet-700' },
  förbättrat: { label: 'Förbättrat', pill: 'bg-amber-100 text-amber-700'  },
  fixat:      { label: 'Fixat',      pill: 'bg-green-100 text-green-700'  },
}

export default function UppdateringarPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => { if (e.initial[0] < 30) setSidebarOpen(true) },
    onSwipedLeft:  ()  => setSidebarOpen(false),
    preventScrollOnSwipe: true,
    touchEventOptions: { passive: false },
  })

  const [latest, ...older] = UPDATES

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        selectedSourceId={null}
        onSelectSource={() => {}}
        unreadSourceIds={new Set()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-y-auto select-none md:select-auto">
        {/* Hamburger — mobil */}
        <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Öppna meny"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">

          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Nyheter &amp; uppdateringar
          </h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
            Vad som är nytt i tjänsten — uppdateras när något som påverkar dig som användare förändras.
          </p>

          {/* Senaste uppdatering — framhävd */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden mb-6">
            <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-8 py-6 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Senaste</span>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">{latest.title}</h2>
                <p className="text-violet-200 text-sm mt-1">{latest.date}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
                🚀
              </div>
            </div>
            <div className="px-8 py-5 flex flex-col gap-3">
              {latest.changes.map((c, i) => {
                const cfg = TYPE_CONFIG[c.type]
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.pill}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{c.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Äldre uppdateringar */}
          {older.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
              {older.map(update => (
                <div key={update.title} className="px-8 py-5">
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">{update.title}</span>
                    <span className="text-xs text-slate-400 font-medium">{update.date}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {update.changes.map((c, i) => {
                      const cfg = TYPE_CONFIG[c.type]
                      return (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.pill}`}>
                            {cfg.label}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{c.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
