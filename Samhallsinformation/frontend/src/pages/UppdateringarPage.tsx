import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '../components/Sidebar/Sidebar'
import MobilTopBar from '../components/common/MobilTopBar'
import { fetchUppdateringar, uppdateringarQueryKey } from '../api/uppdateringar'
import { useAuth } from '../context/AuthContext'
import { getTypConfig } from '../lib/uppdateringTyp'


function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function UppdateringarPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => { if (e.initial[0] < 30) setSidebarOpen(true) },
    onSwipedLeft:  ()  => setSidebarOpen(false),
    preventScrollOnSwipe: true,
    touchEventOptions: { passive: false },
  })

  const { isLoggedIn } = useAuth()
  const { data: uppdateringar = [] } = useQuery({
    queryKey: uppdateringarQueryKey(isLoggedIn),
    queryFn:  fetchUppdateringar,
  })

  // Backend filtrerar redan anonyma till "alla" (V2-7); detta filter behålls som
  // andra försvarslinje (äldre cachade svar) och för att den här publika sidan
  // medvetet bara visar besökarvänligt innehåll även för inloggade.
  // Bara punkter märkta "alla" ska synas här. En
  // release utan några synliga punkter kvar visas inte alls.
  const besökarvänliga = uppdateringar
    .map(u => ({ ...u, punkter: u.punkter.filter(p => p.synlighet === 'alla') }))
    .filter(u => u.punkter.length > 0)

  const [latest, ...older] = besökarvänliga

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900">
      <Sidebar
        selectedShortName={null}
        onSelectSource={() => {}}
        viewMode="Allt"
        onSelectViewMode={() => {}}
        unreadSourceIds={new Set()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-y-auto select-none md:select-auto">
        <MobilTopBar onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="max-w-2xl mx-auto px-6 py-12">

          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Nyheter &amp; uppdateringar
          </h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
            Vad som är nytt i tjänsten — uppdateras när något som påverkar dig som användare förändras.
          </p>

          {latest && (
            <>
              {/* Senaste uppdatering — framhävd */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden mb-6">
                <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-8 py-6 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Senaste</span>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">{latest.titel}</h2>
                    <p className="text-violet-200 text-sm mt-1">{formatDatum(latest.datum)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
                    🚀
                  </div>
                </div>
                <div className="px-8 py-5 flex flex-col gap-3">
                  {latest.punkter.map(p => {
                    const cfg = getTypConfig(p.typ)
                    return (
                      <div key={p.id} className="flex items-start gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{p.text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Äldre uppdateringar */}
              {older.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
                  {older.map(update => (
                    <div key={update.id} className="px-8 py-5">
                      <div className="flex items-baseline gap-3 mb-3">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">{update.titel}</span>
                        <span className="text-xs text-slate-400 font-medium">{formatDatum(update.datum)}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {update.punkter.map(p => {
                          const cfg = getTypConfig(p.typ)
                          return (
                            <div key={p.id} className="flex items-start gap-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                              <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{p.text}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
