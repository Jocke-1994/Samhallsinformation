import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEY) === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }, [dark])

  function toggle() {
    setDark(prev => !prev)
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
