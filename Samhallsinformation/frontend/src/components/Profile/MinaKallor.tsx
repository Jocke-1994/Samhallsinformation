import { useState } from 'react'

interface MockSource {
  id: number
  name: string
  category: string
}

const ALL_SOURCES: MockSource[] = [
  { id: 1, name: 'Göteborgs Stad',               category: 'Kommun' },
  { id: 2, name: 'Västra Götalandsregionen',      category: 'Region' },
  { id: 3, name: 'Trafikverket',                  category: 'Nationell' },
  { id: 4, name: 'SMHI',                          category: 'Nationell' },
  { id: 5, name: 'Västtrafik',                    category: 'Regional' },
  { id: 6, name: 'Polisen',                       category: 'Nationell' },
  { id: 7, name: 'Länsstyrelsen Västra Götaland', category: 'Länsstyrelse' },
  { id: 8, name: 'MSB',                           category: 'Nationell' },
]

const CATEGORY_COLORS: Record<string, string> = {
  'Nationell':   'bg-violet-100 text-violet-700',
  'Kommun':      'bg-blue-100 text-blue-700',
  'Region':      'bg-emerald-100 text-emerald-700',
  'Regional':    'bg-teal-100 text-teal-700',
  'Länsstyrelse':'bg-amber-100 text-amber-700',
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500',  'bg-rose-500', 'bg-teal-500',
]

const SPAR_SUGGESTED_IDS = [1, 2, 5, 7]
type SparState = 'idle' | 'loading' | 'suggestions'

function SourceAvatar({ name, index }: { name: string; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {name[0]}
    </div>
  )
}

export default function MinaKallor() {
  const [activeIds, setActiveIds] = useState<Set<number>>(new Set([1, 2, 3, 6]))
  const [sparState, setSparState] = useState<SparState>('idle')
  const [sparSelected, setSparSelected] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const activeSources = ALL_SOURCES.filter(s => activeIds.has(s.id))
  const sparSuggestions = ALL_SOURCES.filter(s => SPAR_SUGGESTED_IDS.includes(s.id) && !activeIds.has(s.id))
  const searchResults = searchQuery.trim().length > 0
    ? ALL_SOURCES.filter(s => !activeIds.has(s.id) && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  function handleRemove(id: number) {
    setActiveIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }
  function handleAdd(id: number) {
    setActiveIds(prev => new Set(prev).add(id))
    setSearchQuery('')
  }
  function handleSpar() {
    setSparState('loading')
    setSparSelected(new Set(sparSuggestions.map(s => s.id)))
    setTimeout(() => setSparState('suggestions'), 1500)
  }
  function handleSparConfirm() {
    setActiveIds(prev => { const n = new Set(prev); sparSelected.forEach(id => n.add(id)); return n })
    setSparState('idle')
    setSparSelected(new Set())
  }
  function handleSparToggle(id: number) {
    setSparSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function handleDeleteAll() {
    setActiveIds(new Set())
    setShowDeleteConfirm(false)
  }

  return (
    <div className="flex flex-col gap-6 mt-6 max-w-4xl">

      {/* Topp-rad: SPAR + Sök */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SPAR */}
        <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-5">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl mb-4">🏠</div>
            <h2 className="text-lg font-bold text-slate-900">Hämta via SPAR</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Koppla källor automatiskt baserat på din folkbokföringsadress.
            </p>

            <div className="mt-5">
              {sparState === 'idle' && (
                <button
                  onClick={handleSpar}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow"
                >
                  Hämta förslag
                </button>
              )}
              {sparState === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-violet-500 animate-pulse">
                  <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  Hämtar från SPAR...
                </div>
              )}
              {sparState === 'suggestions' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-700">Föreslagna källor</p>
                  {sparSuggestions.length === 0 ? (
                    <p className="text-sm text-slate-400">Inga nya källor att lägga till.</p>
                  ) : (
                    sparSuggestions.map(s => (
                      <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={sparSelected.has(s.id)}
                          onChange={() => handleSparToggle(s.id)}
                          className="accent-violet-600 w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 group-hover:text-slate-900">{s.name}</span>
                      </label>
                    ))
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSparConfirm}
                      disabled={sparSelected.size === 0}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all"
                    >
                      Lägg till ({sparSelected.size})
                    </button>
                    <button
                      onClick={() => setSparState('idle')}
                      className="px-4 py-2 text-slate-500 hover:text-slate-900 text-sm rounded-xl transition-colors"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lägg till källa */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl mb-4">🔍</div>
            <h2 className="text-lg font-bold text-slate-900">Lägg till källa</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Sök bland tillgängliga myndigheter och organisationer.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök källa..."
                className="w-full bg-slate-50 text-slate-900 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white placeholder-slate-400 transition-colors"
              />
              {searchResults.length > 0 && (
                <div className="flex flex-col divide-y divide-slate-100 mt-1">
                  {searchResults.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.category}</p>
                      </div>
                      <button
                        onClick={() => handleAdd(s.id)}
                        className="ml-4 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        + Lägg till
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery.trim().length > 0 && searchResults.length === 0 && (
                <p className="text-sm text-slate-400 mt-1">Ingen källa hittades.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Aktiva källor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aktiva källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Dessa myndigheter visas i ditt nyhetsflöde</p>
          </div>
          <span className="bg-violet-100 text-violet-700 text-sm font-bold px-3 py-1 rounded-full">
            {activeSources.length}
          </span>
        </div>

        {activeSources.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-medium text-slate-700">Inga aktiva källor</p>
            <p className="text-xs text-slate-400 mt-1">Använd sökfältet ovan för att lägga till källor</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeSources.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors group">
                <SourceAvatar name={s.name} index={i} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[s.category] ?? 'bg-slate-100 text-slate-600'}`}>
                    {s.category}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-lg leading-none"
                  title="Ta bort"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {activeSources.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
              >
                Radera alla källor
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-600">Är du säker? Detta kan inte ångras.</p>
                <button
                  onClick={handleDeleteAll}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Ja, radera
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
