import { useState } from 'react'

export default function Datahantering({ highlightId, namnValue, epostValue }: {
  highlightId: string | null
  namnValue: string
  epostValue: string
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function handleExport() {
    const data = {
      namn: namnValue || '(ej angivet)',
      epost: epostValue || '(ej angivet)',
      kallor: ['(mock) Polisen', '(mock) Trafikverket'],
      notifieringar: { kanal: 'e-post', regler: [] },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'min-data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div id="datahantering" className={`bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden ${highlightId === 'datahantering' ? 'card-highlight' : ''}`}>
      <div className="px-6 pt-6 pb-5 border-b border-red-100 bg-gradient-to-br from-red-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">🗑️</div>
          <div>
            <h2 className="text-lg font-bold text-red-700">Datahantering</h2>
            <p className="text-sm text-red-400 mt-0.5">Export och permanent radering</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">

        {/* Export */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Exportera din data</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ladda ner all data vi har om dig som JSON-fil (GDPR art. 20).
            </p>
          </div>
          <button
            onClick={handleExport}
            className="shrink-0 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
          >
            Ladda ner
          </button>
        </div>

        {/* Radera */}
        <div className="border-t border-red-100 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Radera konto</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Permanent radering av konto och all data. Kan inte ångras.
              </p>
            </div>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold rounded-xl transition-colors border border-red-200"
              >
                Radera
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-800">
                Är du helt säker? Detta kan inte ångras.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Ja, radera mitt konto
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium rounded-xl transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
