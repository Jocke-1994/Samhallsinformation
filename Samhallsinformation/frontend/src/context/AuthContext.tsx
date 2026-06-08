import { createContext, useContext, useState } from 'react'

export type SystemRoll = 'Användare' | 'Support' | 'Admin'

interface AuthContextType {
  isLoggedIn: boolean
  roll: SystemRoll
  aktivVy: SystemRoll
  login: () => void
  logout: () => void
  byttVy: (vy: SystemRoll) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Dev-default: Admin så att alla vyer är åtkomliga
const DEFAULT_ROLL: SystemRoll = 'Admin'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('si_logged_in') === 'true'
  )
  const [roll] = useState<SystemRoll>(
    () => (localStorage.getItem('si_roll') as SystemRoll) ?? DEFAULT_ROLL
  )
  const [aktivVy, setAktivVy] = useState<SystemRoll>(
    () => (localStorage.getItem('si_aktiv_vy') as SystemRoll) ?? roll
  )

  function login() {
    localStorage.setItem('si_logged_in', 'true')
    setIsLoggedIn(true)
  }

  function logout() {
    localStorage.removeItem('si_logged_in')
    localStorage.removeItem('si_aktiv_vy')
    setIsLoggedIn(false)
    setAktivVy(roll)
  }

  function byttVy(vy: SystemRoll) {
    localStorage.setItem('si_aktiv_vy', vy)
    setAktivVy(vy)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, roll, aktivVy, login, logout, byttVy }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
