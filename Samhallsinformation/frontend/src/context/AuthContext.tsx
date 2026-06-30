import { createContext, useContext, useState } from 'react'

export type SystemRoll = 'Användare' | 'Support' | 'Admin'

interface AuthContextType {
  isLoggedIn: boolean
  roll: SystemRoll
  aktivVy: SystemRoll
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  byttVy: (vy: SystemRoll) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function parseRole(token: string): SystemRoll {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const role = payload['role']
    if (role === 'Admin') return 'Admin'
    if (role === 'Support') return 'Support'
  } catch { /* ignore */ }
  return 'Användare'
}

async function authRequest(url: string, body: object): Promise<{ token: string; role: string; name: string }> {
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

  const isLoggedIn = token !== null
  const roll       = token ? parseRole(token) : 'Användare'

  const [aktivVy, setAktivVy] = useState<SystemRoll>(
    () => (localStorage.getItem('si_aktiv_vy') as SystemRoll) ?? roll
  )

  function applyToken(data: { token: string }) {
    localStorage.setItem('si_token', data.token)
    localStorage.setItem('si_logged_in', 'true')
    setToken(data.token)
    const newRoll = parseRole(data.token)
    setAktivVy(newRoll)
    localStorage.setItem('si_aktiv_vy', newRoll)
  }

  async function login(email: string, password: string): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/login`, { email, password })
    applyToken(data)
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/register`, { name, email, password })
    applyToken(data)
  }

  function logout() {
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_logged_in')
    localStorage.removeItem('si_aktiv_vy')
    setToken(null)
    setAktivVy('Användare')
  }

  function byttVy(vy: SystemRoll) {
    localStorage.setItem('si_aktiv_vy', vy)
    setAktivVy(vy)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, roll, aktivVy, login, register, logout, byttVy }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
