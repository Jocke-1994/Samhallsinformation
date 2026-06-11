import { useState, useEffect } from 'react'

const STORAGE_KEY = 'cookie_consent'

type ConsentChoice = 'all' | 'necessary'

export function getCookieConsent(): ConsentChoice | null {
  return localStorage.getItem(STORAGE_KEY) as ConsentChoice | null
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true)
  }, [])

  if (!visible) return null

  function accept(choice: ConsentChoice) {
    localStorage.setItem(STORAGE_KEY, choice)
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: choice === 'all' ? 'granted' : 'denied',
      })
    }
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9000] p-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl px-6 py-5 flex flex-col gap-4">

        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
              Den här webbplatsen använder cookies
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Vi använder nödvändiga cookies för att tjänsten ska fungera. Med ditt samtycke använder vi även analys-cookies för att förstå hur appen används och förbättra den.{' '}
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
              >
                {expanded ? 'Dölj detaljer' : 'Läs mer'}
              </button>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={() => accept('necessary')}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Bara nödvändiga
            </button>
            <button
              onClick={() => accept('all')}
              className="text-sm font-medium px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors"
            >
              Acceptera alla
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Nödvändiga (alltid aktiva)
              </p>
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
                <li><span className="font-medium text-slate-600 dark:text-slate-300">cookie_consent</span> — sparar ditt samtycke lokalt, skickas aldrig vidare</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Analys (kräver samtycke)
              </p>
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
                <li><span className="font-medium text-slate-600 dark:text-slate-300">Google Analytics</span> — sidvisningar och sessionslängd</li>
                <li>Ungefärlig geografisk plats (land/region, ej exakt adress)</li>
                <li>Enhetstyp och webbläsare</li>
                <li>IP-adress anonymiseras innan lagring</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
