import { Link } from 'react-router'
import { useFlags } from '../context/FeatureFlagsContext'
import { isSektionSynlig } from '../lib/featureFlags'
import { useSiteSettings } from '../hooks/useSiteSettings'

// Samma sektioner som ProfileLanding.tsx (inloggad vy) filtrerar bort med
// isSektionSynlig — annars lovar den här listan funktioner som faktiskt är
// avstängda, t.ex. den gamla mail/SMS-notismodellen som aldrig byggdes
// (notif_*-flaggorna är alla av, ersatta av push bakom en egen, ännu
// avstängd flagga).
const FEATURES = [
  {
    sektion: 'mina-kallor',
    icon: '🗂️',
    label: 'Mina källor',
    desc: 'Välj vilka myndigheter som visas i ditt flöde',
  },
  {
    sektion: 'notifieringar',
    icon: '🔔',
    label: 'Notifieringar',
    desc: 'Få aviseringar via e-post eller SMS',
  },
  { sektion: 'konto', icon: '👤', label: 'Konto', desc: 'Hantera dina uppgifter och din data' },
  {
    sektion: 'support',
    icon: '💬',
    label: 'Support',
    desc: 'Skicka ärenden och följ deras status',
  },
]

export default function GästProfil() {
  const flaggor = useFlags()
  const { showLoginButton, showRegisterButton } = useSiteSettings()
  const synligaFeatures = FEATURES.filter((f) => isSektionSynlig(f.sektion, flaggor))

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
            Logga in eller skapa ett konto för att hantera
            <br />
            dina inställningar och notifieringar.
          </p>
        </div>

        {/* Knappar — riktiga länkar till /login och /register (samma sidor
            som resten av appen använder, inkl. Google och glömt lösenord),
            inte en modal som bara kunde logga in oavsett vilken knapp man
            klickade på. */}
        {(showLoginButton || showRegisterButton) && (
          <div className="flex gap-3 w-full">
            {showLoginButton && (
              <Link
                to="/login?redirect=/profil"
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm text-center"
              >
                Logga in
              </Link>
            )}
            {showRegisterButton && (
              <Link
                to="/register?redirect=/profil"
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors text-center"
              >
                Skapa konto
              </Link>
            )}
          </div>
        )}

        {/* Funktionslista */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-5 pt-4 pb-2">
            Med ett konto kan du
          </p>
          {synligaFeatures.map((f, i) => (
            <div
              key={f.label}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < synligaFeatures.length - 1 ? 'border-b border-slate-100' : ''}`}
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
    </div>
  )
}
