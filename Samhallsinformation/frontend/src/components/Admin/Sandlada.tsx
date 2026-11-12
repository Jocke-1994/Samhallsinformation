import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchPreviewEvents,
  dryRunSource,
  type PreviewSource,
  type DryRunResult,
} from '../../api/testing'
import NewsItem from '../NewsFeed/NewsItem'

type Flik = 'forhandsvisning' | 'testa'

export default function Sandlada() {
  const [flik, setFlik] = useState<Flik>('forhandsvisning')

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        Sandlådan låter dig förhandsgranska händelser från opublicerade källor och testa nya
        RSS-flöden utan att de syns för besökare.
      </p>

      {/* Tabbar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-8">
        {(
          [
            ['forhandsvisning', '🔭 Förhandsvisning'],
            ['testa', '⚗️ Testa källa'],
          ] as [Flik, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFlik(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              flik === key
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {flik === 'forhandsvisning' && <Forhandsvisning />}
      {flik === 'testa' && <TestaKalla />}
    </div>
  )
}

function Forhandsvisning() {
  const { data, isLoading, isError, refetch } = useQuery<PreviewSource[]>({
    queryKey: ['testing-preview'],
    queryFn: fetchPreviewEvents,
  })

  if (isLoading) return <Spinner />

  if (isError)
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        Kunde inte hämta förhandsvisning.{' '}
        <button onClick={() => refetch()} className="underline font-medium">
          Försök igen
        </button>
      </div>
    )

  if (!data || data.length === 0)
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-3xl mb-3">🔭</p>
        <p className="text-sm font-medium">Inga aktiva testflöden just nu</p>
        <p className="text-xs mt-1">
          Aktivera en källa i källhanteringen utan att publicera den — händelserna visas här.
        </p>
      </div>
    )

  return (
    <div className="flex flex-col gap-10">
      {data.map((src) => (
        <SourceBlock key={src.sourceId} src={src} />
      ))}
    </div>
  )
}

function SourceBlock({ src }: { src: PreviewSource }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 group">
          <span
            className="text-slate-400 text-xs transition-transform duration-200"
            style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : '' }}
          >
            ▶
          </span>
          <h3 className="text-base font-semibold text-slate-800 group-hover:text-violet-600 transition-colors">
            {src.sourceName}
          </h3>
        </button>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          Opublicerad
        </span>
        <span className="text-xs text-slate-400">{src.events.length} händelser</span>
      </div>

      {expanded &&
        (src.events.length === 0 ? (
          <p className="text-sm text-slate-400 pl-5">Inga händelser ingestade ännu.</p>
        ) : (
          <div className="flex flex-col gap-2 pl-5">
            {src.events.map((e) => (
              <NewsItem key={e.id} event={e} isRead={false} sourceName={src.sourceName} />
            ))}
          </div>
        ))}
    </div>
  )
}

function TestaKalla() {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!url.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await dryRunSource(url.trim(), name.trim())
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">RSS-flöde att testa</h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              URL till RSS/Atom-flöde
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/rss"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Namn (valfritt)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hämtas från URL om tomt"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <button
            onClick={run}
            disabled={loading || !url.trim()}
            className="self-start mt-1 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Hämtar...' : 'Kör test'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {result && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-sm font-semibold text-slate-800">Resultat</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {result.count} händelser
            </span>
            <span className="text-xs text-slate-400">— ingenting sparas</span>
          </div>

          {result.count === 0 ? (
            <p className="text-sm text-slate-400">Flödet returnerade inga händelser.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {result.events.map((e, i) => (
                <NewsItem key={e.id || i} event={e} isRead={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )
}
