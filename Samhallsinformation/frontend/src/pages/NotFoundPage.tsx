import { Link } from 'react-router'

// Catch-all för URL:er som inte matchar någon route. Samma kortstil som
// övriga enkla sidor (CancelDeletionPage) och fungerar för både gäster och
// inloggade — inga auth-beroenden.
export default function NotFoundPage() {
  return (
    <div className="min-h-full h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-violet-600">Samhällsinfo</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="text-3xl mb-4">🔍</div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Sidan finns inte
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Länken kan vara felstavad eller så har sidan flyttats.
          </p>
          <Link
            to="/"
            className="block w-full py-2.5 mt-6 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Till startsidan
          </Link>
        </div>
      </div>
    </div>
  )
}
