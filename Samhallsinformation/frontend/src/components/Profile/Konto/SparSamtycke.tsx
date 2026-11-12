import { useState } from 'react'

const STORAGE_KEY = 'spar_samtycke'

export default function SparSamtycke() {
  const [samtycke, setSamtycke] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')

  function handleAktivera() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setSamtycke(true)
  }

  function handleAterkalla() {
    localStorage.removeItem(STORAGE_KEY)
    setSamtycke(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            🏛️
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">SPAR-hämtning</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Automatisk hämtning av folkbokföringsadress
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          SPAR (Statens personadressregister) används för att hämta din folkbokföringsadress och
          föreslå relevanta regionala källor i Mina källor. Vi hämtar endast din adress och sparar
          den lokalt på ditt konto.
        </p>

        {samtycke ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <span className="text-green-600 text-lg">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">SPAR-hämtning är aktiverad</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Folkbokföringsadress: Storgatan 1, Stockholm{' '}
                  <span className="text-green-400">(mock)</span>
                </p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Återkalla samtycke</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sparade adressuppgifter tas bort och automatisk hämtning inaktiveras.
                </p>
              </div>
              <button
                onClick={handleAterkalla}
                className="shrink-0 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
              >
                Återkalla
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Genom att aktivera godkänner du att vi hämtar och lagrar din folkbokföringsadress från
              SPAR (GDPR art. 6.1a).
            </p>
            <button
              onClick={handleAktivera}
              className="shrink-0 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Aktivera
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
