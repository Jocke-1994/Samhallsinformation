interface ChangeEntry {
  type: 'nytt' | 'förbättrat' | 'fixat'
  text: string
}

interface Release {
  version: string
  date: string
  changes: ChangeEntry[]
}

interface KändBugg {
  text: string
  allvar: 'låg' | 'medel' | 'hög'
}

const RELEASES: Release[] = [
  {
    version: '0.4.0',
    date: '9 mars 2026',
    changes: [
      { type: 'nytt', text: 'Din profilsida är nu tillgänglig — hantera källor, notifieringar och kontoinställningar' },
      { type: 'nytt', text: 'Filtrera notiser per stad eller län för att bara få information som berör dig' },
      { type: 'nytt', text: 'Du kan nu ladda ner all information vi har om dig som en fil' },
    ],
  },
  {
    version: '0.3.0',
    date: '16 februari 2026',
    changes: [
      { type: 'nytt', text: 'Nyhetsflöde med navigering mellan olika myndigheter i menyn till vänster' },
      { type: 'nytt', text: 'Stöd för att följa flera myndigheter samtidigt' },
      { type: 'förbättrat', text: 'Samma nyhet visas inte längre flera gånger' },
    ],
  },
  {
    version: '0.2.0',
    date: '12 februari 2026',
    changes: [
      { type: 'nytt', text: 'Nyheter från Polisen hämtas nu automatiskt' },
      { type: 'nytt', text: 'Grundläggande webbgränssnitt för att visa händelser' },
      { type: 'nytt', text: 'Information sparas nu i en databas' },
    ],
  },
  {
    version: '0.1.0',
    date: '1 februari 2026',
    changes: [
      { type: 'nytt', text: 'Första versionen av tjänsten lanserad' },
    ],
  },
]

const KANDA_BUGGAR: KändBugg[] = [
  {
    text: 'Nyhetsflödet laddas inte alltid om automatiskt när du byter källa — lös det genom att klicka på källan igen.',
    allvar: 'låg',
  },
]

const TYPE_CONFIG: Record<ChangeEntry['type'], { label: string; pill: string; dot: string }> = {
  nytt:        { label: 'Nytt',        pill: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500' },
  förbättrat:  { label: 'Förbättrat',  pill: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400'  },
  fixat:       { label: 'Fixat',       pill: 'bg-green-100 text-green-700',    dot: 'bg-green-500'  },
}

const ALLVAR_CONFIG: Record<KändBugg['allvar'], { bar: string; bg: string; label: string; labelColor: string }> = {
  låg:   { bar: 'bg-slate-300',  bg: 'bg-slate-50  border-slate-200',  label: 'Låg prioritet',  labelColor: 'text-slate-500'  },
  medel: { bar: 'bg-amber-400',  bg: 'bg-amber-50  border-amber-200',  label: 'Medel prioritet', labelColor: 'text-amber-700'  },
  hög:   { bar: 'bg-red-500',    bg: 'bg-red-50    border-red-200',    label: 'Hög prioritet',  labelColor: 'text-red-600'    },
}

export default function Uppdateringar() {
  const latest = RELEASES[0]

  return (
    <div className="flex flex-col gap-6 mt-6 max-w-2xl">

      {/* Senaste version — hero-kort */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl px-8 py-8 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Senaste version</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1">v{latest.version}</h2>
            <p className="text-violet-200 text-sm mt-1">{latest.date}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
            🚀
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          {latest.changes.map((c, i) => {
            const cfg = TYPE_CONFIG[c.type]
            return (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.pill}`}>
                  {cfg.label}
                </span>
                <span className="text-sm text-violet-100 leading-relaxed">{c.text}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Kända problem */}
      {KANDA_BUGGAR.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🐛</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Kända problem</h2>
                <p className="text-sm text-slate-500 mt-0.5">Vi arbetar på att lösa dessa</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-3">
            {KANDA_BUGGAR.map((bugg, i) => {
              const cfg = ALLVAR_CONFIG[bugg.allvar]
              return (
                <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3.5 ${cfg.bg}`}>
                  <div className={`w-1 rounded-full shrink-0 ${cfg.bar}`} />
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.labelColor}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">{bugg.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Versionshistorik */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">📋</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Versionshistorik</h2>
              <p className="text-sm text-slate-500 mt-0.5">Alla tidigare uppdateringar</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {RELEASES.slice(1).map((release, ri) => (
            <div key={release.version} className="flex gap-5">
              {/* Timeline */}
              <div className="flex flex-col items-center pt-1 w-4 shrink-0">
                <div className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
                {ri < RELEASES.length - 2 && <div className="w-px flex-1 bg-slate-200 mt-1.5" />}
              </div>

              {/* Innehåll */}
              <div className="flex flex-col gap-3 pb-8 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-base font-bold text-slate-900">v{release.version}</span>
                  <span className="text-xs text-slate-400 font-medium">{release.date}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {release.changes.map((c, i) => {
                    const cfg = TYPE_CONFIG[c.type]
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.pill}`}>
                          {cfg.label}
                        </span>
                        <span className="text-sm text-slate-600 leading-relaxed">{c.text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
