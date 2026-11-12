import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import "./index.css"
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'
import { PolisenBevakningarProvider } from './context/PolisenBevakningarContext'
import { SavedEventsProvider } from './context/SavedEventsContext'
import MaybeGoogleOAuthProvider from './components/Auth/MaybeGoogleOAuthProvider'
import ErrorBoundary from './components/common/ErrorBoundary'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('Service worker-registrering misslyckades', err)
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // Data anses färsk i 1 minut
      retry: 1,
    },
  },
})

// Yttersta ErrorBoundary ligger utanför alla providers — då fångas även ett
// fel i en provider, och den beroendefria felvyn används i stället för vit
// skärm. (Sid-nivåns boundary för enskilda routes ligger i App.tsx.)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <FeatureFlagsProvider>
              <ThemeProvider>
                <PolisenBevakningarProvider>
                  <SavedEventsProvider>
                    <MaybeGoogleOAuthProvider>
                      <App />
                    </MaybeGoogleOAuthProvider>
                  </SavedEventsProvider>
                </PolisenBevakningarProvider>
              </ThemeProvider>
            </FeatureFlagsProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
