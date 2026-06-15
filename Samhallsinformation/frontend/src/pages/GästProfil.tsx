import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: '🗂️', label: 'Mina källor',    desc: 'Välj vilka myndigheter som visas i ditt flöde' },
  { icon: '🔔', label: 'Notifieringar',  desc: 'Få aviseringar via e-post eller SMS' },
  { icon: '👤', label: 'Konto',          desc: 'Hantera dina uppgifter och din data' },
  { icon: '💬', label: 'Support',        desc: 'Skicka ärenden och följ deras status' },
]

function InloggningsModal({ onClose, onLogin, mode }: { onClose: () => void; onLogin: (email: string, password: string) => Promise<void>; mode: 'logga-in' | 'skapa-konto' }) {
  const [epost, setEpost] = useState('')
  const [losenord, setLosenord] = useState('')
  const [view, setView] = useState<'logga-in' | 'skapa-konto'>(mode)
  const [laddar, setLaddar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isLogIn = view === 'logga-in'

  async function hanteraLogga() {
    if (!epost || !losenord) return
    setFel(null)
    setLaddar(true)
    try {
      await onLogin(epost, losenord)
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setLaddar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{isLogIn ? 'Logga in' : 'Skapa konto'}</h2>
            <p className="text-violet-200 text-sm mt-0.5">
              {isLogIn ? 'Välkommen tillbaka' : 'Kom igång med Samhällsinformation'}
            </p>
          </div>
          <button onClick={onClose} className="text-violet-300 hover:text-white transition-colors text-lg leading-none mt-0.5">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Felmeddelande */}
          {fel && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              {fel}
            </div>
          )}

          {/* E-post + lösenord */}
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={epost}
              onChange={e => setEpost(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') hanteraLogga() }}
              placeholder="E-postadress"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-400 text-slate-900 transition-all"
            />
            <div className="flex flex-col gap-1">
              <input
                type="password"
                value={losenord}
                onChange={e => setLosenord(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') hanteraLogga() }}
                placeholder="Lösenord"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-400 text-slate-900 transition-all"
              />
            </div>
            <button
              onClick={hanteraLogga}
              disabled={laddar || !epost || !losenord}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {laddar ? 'Loggar in...' : isLogIn ? 'Logga in' : 'Skapa konto'}
            </button>
          </div>

          {/* Byt vy */}
          <p className="text-xs text-slate-400 text-center">
            {isLogIn ? 'Har du inget konto?' : 'Har du redan ett konto?'}{' '}
            <button
              onClick={() => { setView(isLogIn ? 'skapa-konto' : 'logga-in'); setFel(null) }}
              className="font-semibold text-violet-600 hover:text-violet-500 transition-colors"
            >
              {isLogIn ? 'Skapa konto' : 'Logga in'}
            </button>
          </p>

        </div>
      </div>
    </div>
  )
}

export default function GästProfil() {
  const { login } = useAuth()
  const [modalMode, setModalMode] = useState<'logga-in' | 'skapa-konto' | null>(null)

  async function hanteraLogin(email: string, password: string) {
    await login(email, password)
    setModalMode(null)
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-10 py-16">
      <div className="w-full max-w-md flex flex-col items-center gap-8">

        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-3xl shadow-md">
          👤
        </div>

        {/* Text */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900">Min profil</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Logga in eller skapa ett konto för att hantera<br />dina inställningar och notifieringar.
          </p>
        </div>

        {/* Knappar */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => setModalMode('logga-in')}
            className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Logga in
          </button>
          <button
            onClick={() => setModalMode('skapa-konto')}
            className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors"
          >
            Skapa konto
          </button>
        </div>

        {/* Funktionslista */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-5 pt-4 pb-2">
            Med ett konto kan du
          </p>
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < FEATURES.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <span className="text-xl shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
      {modalMode && (
        <InloggningsModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onLogin={hanteraLogin}
        />
      )}
    </div>
  )
}
