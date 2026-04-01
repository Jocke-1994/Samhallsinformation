import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: '🗂️', label: 'Mina källor',    desc: 'Välj vilka myndigheter som visas i ditt flöde' },
  { icon: '🔔', label: 'Notifieringar',  desc: 'Få aviseringar via e-post eller SMS' },
  { icon: '👤', label: 'Konto',          desc: 'Hantera dina uppgifter och din data' },
  { icon: '💬', label: 'Support',        desc: 'Skicka ärenden och följ deras status' },
]

function InloggningsModal({ onClose, onLogin, mode }: { onClose: () => void; onLogin: () => void; mode: 'logga-in' | 'skapa-konto' }) {
  const [epost, setEpost] = useState('')
  const [losenord, setLosenord] = useState('')
  const [view, setView] = useState<'logga-in' | 'skapa-konto'>(mode)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isLogIn = view === 'logga-in'

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

          {/* Google */}
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Fortsätt med Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">eller</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* E-post + lösenord */}
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={epost}
              onChange={e => setEpost(e.target.value)}
              placeholder="E-postadress"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-400 text-slate-900 transition-all"
            />
            <div className="flex flex-col gap-1">
              <input
                type="password"
                value={losenord}
                onChange={e => setLosenord(e.target.value)}
                placeholder="Lösenord"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-400 text-slate-900 transition-all"
              />
              {isLogIn && (
                <button className="text-xs text-slate-400 hover:text-violet-600 transition-colors text-right">
                  Glömt lösenord?
                </button>
              )}
            </div>
            <button
              onClick={onLogin}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {isLogIn ? 'Logga in' : 'Skapa konto'}
            </button>
          </div>

          {/* Byt vy */}
          <p className="text-xs text-slate-400 text-center">
            {isLogIn ? 'Har du inget konto?' : 'Har du redan ett konto?'}{' '}
            <button
              onClick={() => setView(isLogIn ? 'skapa-konto' : 'logga-in')}
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
          onLogin={() => { login(); setModalMode(null) }}
        />
      )}
    </div>
  )
}
