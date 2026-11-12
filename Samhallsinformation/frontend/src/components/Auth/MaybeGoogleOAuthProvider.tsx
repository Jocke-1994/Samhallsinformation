import { GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID } from '../../lib/googleAuth'

// GoogleOAuthProvider förutsätter en giltig client-id och loggar annars fel i
// konsolen — hoppa över den helt lokalt tills VITE_GOOGLE_CLIENT_ID är satt.
// GoogleSignInButton döljer sig själv på samma villkor.
export default function MaybeGoogleOAuthProvider({ children }: { children: React.ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return children
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="sv">
      {children}
    </GoogleOAuthProvider>
  )
}
