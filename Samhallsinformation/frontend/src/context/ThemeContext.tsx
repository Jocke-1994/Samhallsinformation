import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'true-black' | 'dark' | 'tan' | 'light'

const STORAGE_KEY = 'theme'
const VALID_THEMES: Theme[] = ['true-black', 'dark', 'tan', 'light']

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} })

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && VALID_THEMES.includes(stored as Theme)) return stored as Theme
  return 'dark'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  if (theme === 'dark' || theme === 'true-black') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    const w = window as Window & { gtag?: (...args: unknown[]) => void }
    w.gtag?.('event', 'theme_change', { theme: t })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
