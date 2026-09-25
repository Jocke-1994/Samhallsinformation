import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /**
   * När något i listan ändras (t.ex. `location.key` vid navigering) nollställs
   * felet och barnen renderas om — annars fastnar användaren i felvyn även
   * efter att ha klickat till en annan sida.
   */
  resetKeys?: unknown[]
  /** Egen fallback. Standard är den beroendefria felvyn nedan. */
  fallback?: ReactNode
}

interface State {
  fel: Error | null
}

function nycklarErOlika(a: unknown[] = [], b: unknown[] = []): boolean {
  return a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
}

// Beroendefri felvy: använder inga kontexter, ingen router och inga hooks, så
// att den fungerar även om en provider själv kastar. Mörkt läge styrs av
// `html.dark`-reglerna i index.css (klasserna nedan täcks av dem), inte av
// ThemeContext. Länken är en vanlig <a> (full omladdning) av samma skäl.
export function FelVy() {
  return (
    <div
      role="alert"
      className="min-h-full h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-violet-600">Samhällsinfo</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Något gick fel</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Sidan kunde inte visas. Försök ladda om sidan — om felet finns kvar,
            gå till startsidan och försök igen lite senare.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 mt-6 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Ladda om sidan
          </button>
          <a href="/" className="text-violet-600 hover:text-violet-500 text-sm mt-4 inline-block">
            Till startsidan
          </a>
        </div>
      </div>
    </div>
  )
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { fel: null }

  static getDerivedStateFromError(fel: Error): State {
    return { fel }
  }

  componentDidCatch(fel: Error, info: ErrorInfo) {
    console.error('Renderfel fångades av ErrorBoundary', fel, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.fel && nycklarErOlika(prev.resetKeys, this.props.resetKeys)) {
      this.setState({ fel: null })
    }
  }

  render() {
    if (this.state.fel) return this.props.fallback ?? <FelVy />
    return this.props.children
  }
}
