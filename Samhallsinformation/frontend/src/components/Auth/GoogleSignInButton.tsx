import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Link } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { GOOGLE_CLIENT_ID } from '../../lib/googleAuth'

export interface GoogleProfile {
  email: string
  name: string
}

interface Props {
  onError: (message: string) => void
  onStart?: () => void
  // isNewUser: true om Google-inloggningen skapade ett nytt konto, false om
  // den loggade in på ett redan befintligt (lösenords- eller Google-baserat).
  onSuccess?: (profile: GoogleProfile, isNewUser: boolean) => void
}

// Enbart för visning (t.ex. sammanfattningssteget i onboarding) — inte en
// säkerhetskontroll. Backend validerar samma token på riktigt mot Googles
// JWKS innan kontot skapas/loggas in.
function decodeGoogleProfile(idToken: string): GoogleProfile | null {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]))
    if (typeof payload.email !== 'string') return null
    return { email: payload.email, name: typeof payload.name === 'string' ? payload.name : payload.email }
  } catch {
    return null
  }
}

// Klick på knappen räknas som godkännande (samma mönster som de flesta
// Google/Apple-inloggningar — texten under knappen är samtycket, ingen
// separat kryssruta). Backend kräver ändå acceptedTerms=true för att skapa
// ett nytt konto, så ett förbigått frontend-klick skapar aldrig ett konto
// utan godkännande.
export default function GoogleSignInButton({ onError, onStart, onSuccess }: Props) {
  const { loginWithGoogle } = useAuth()

  if (!GOOGLE_CLIENT_ID) return null

  async function handleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      onError('Google-inloggningen gav inget svar. Försök igen.')
      return
    }
    onStart?.()
    try {
      const isNewUser = await loginWithGoogle(credentialResponse.credential, true)
      const profile = decodeGoogleProfile(credentialResponse.credential)
      onSuccess?.(profile ?? { email: '', name: '' }, isNewUser)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Något gick fel med Google-inloggningen')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 w-full">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs text-slate-400">eller</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError('Google-inloggningen misslyckades. Försök igen.')}
        text="continue_with"
        width="300"
      />

      <p className="text-xs text-slate-400 text-center">
        Genom att fortsätta med Google godkänner du{' '}
        <Link to="/villkor" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-500">
          användarvillkoren
        </Link>
      </p>
    </div>
  )
}
