import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

export type SystemRoll = 'Användare' | 'Support' | 'Admin'

interface AuthContextType {
  isLoggedIn: boolean
  roll: SystemRoll
  aktivVy: SystemRoll
  email: string | null
  name: string | null
  emailVerified: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, acceptedTerms: boolean) => Promise<void>
  loginWithGoogle: (idToken: string, acceptedTerms: boolean) => Promise<void>
  logout: () => void
  byttVy: (vy: SystemRoll) => void
  refreshSession: () => Promise<void>
  setAccessToken: (token: string) => void
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Hur lång tid innan access-token går ut som en ny hämtas
const REFRESH_MARGIN_MS = 2 * 60 * 1000

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function parseRole(token: string): SystemRoll {
  const role = decodePayload(token)?.['role']
  if (role === 'Admin') return 'Admin'
  if (role === 'Support') return 'Support'
  return 'Användare'
}

function decodeExp(token: string): number | null {
  const exp = decodePayload(token)?.['exp']
  return typeof exp === 'number' ? exp * 1000 : null
}

function parseEmail(token: string): string | null {
  const email = decodePayload(token)?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
  return typeof email === 'string' ? email : null
}

function parseName(token: string): string | null {
  const name = decodePayload(token)?.['name']
  return typeof name === 'string' ? name : null
}

function parseEmailVerified(token: string): boolean {
  return decodePayload(token)?.['emailVerified'] === 'true'
}

async function authRequest(url: string, body: object): Promise<TokenPair & { role: string; name: string }> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Något gick fel')
  }
  return res.json()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('si_token'))
  const refreshTokenRef = useRef<string | null>(localStorage.getItem('si_refresh_token'))

  const isLoggedIn    = token !== null
  const roll          = token ? parseRole(token) : 'Användare'
  const email         = token ? parseEmail(token) : null
  const name          = token ? parseName(token) : null
  const emailVerified = token ? parseEmailVerified(token) : false

  const [aktivVy, setAktivVy] = useState<SystemRoll>(
    () => (localStorage.getItem('si_aktiv_vy') as SystemRoll) ?? roll
  )

  const clearSession = useCallback(() => {
    refreshTokenRef.current = null
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_refresh_token')
    localStorage.removeItem('si_logged_in')
    localStorage.removeItem('si_aktiv_vy')
    setToken(null)
    setAktivVy('Användare')
  }, [])

  const applyTokens = useCallback((data: TokenPair) => {
    localStorage.setItem('si_token', data.accessToken)
    localStorage.setItem('si_refresh_token', data.refreshToken)
    localStorage.setItem('si_logged_in', 'true')
    refreshTokenRef.current = data.refreshToken
    const newRoll = parseRole(data.accessToken)
    localStorage.setItem('si_aktiv_vy', newRoll)
    setAktivVy(newRoll)
    setToken(data.accessToken)
  }, [])

  const doRefresh = useCallback(async () => {
    const rt = refreshTokenRef.current
    if (!rt) { clearSession(); return }
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) { clearSession(); return }
      applyTokens(await res.json())
    } catch {
      clearSession()
    }
  }, [applyTokens, clearSession])

  // Schemalägg nästa refresh ~2 min innan access-token går ut. Körs om varje
  // gång token ändras (login/register/refresh) så nästa refresh läggs på nytt.
  useEffect(() => {
    if (!token) return
    const exp = decodeExp(token)
    if (exp === null) return
    const delay = Math.max(0, exp - Date.now() - REFRESH_MARGIN_MS)
    const timer = setTimeout(doRefresh, delay)
    return () => clearTimeout(timer)
  }, [token, doRefresh])

  async function login(email: string, password: string): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/login`, { email, password })
    applyTokens(data)
  }

  async function register(name: string, email: string, password: string, acceptedTerms: boolean): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/register`, { name, email, password, acceptedTerms })
    applyTokens(data)
  }

  async function loginWithGoogle(idToken: string, acceptedTerms: boolean): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/google`, { idToken, acceptedTerms })
    applyTokens(data)
  }

  function logout() {
    const rt = refreshTokenRef.current
    if (rt) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: rt }),
      }).catch(() => { /* best effort — sessionen rensas lokalt oavsett */ })
    }
    clearSession()
  }

  function byttVy(vy: SystemRoll) {
    localStorage.setItem('si_aktiv_vy', vy)
    setAktivVy(vy)
  }

  // Uppdaterar bara access-token lokalt (t.ex. efter PUT /api/auth/me, som
  // returnerar en färsk token med uppdaterade claims) — till skillnad från
  // doRefresh görs inget nätverksanrop, så det finns ingen risk att en
  // rate-limitad /api/auth/refresh-förfrågan loggar ut användaren mitt i en
  // helt orelaterad sparning.
  function setAccessToken(newToken: string) {
    localStorage.setItem('si_token', newToken)
    setToken(newToken)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, roll, aktivVy, email, name, emailVerified, login, register, loginWithGoogle, logout, byttVy, refreshSession: doRefresh, setAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
