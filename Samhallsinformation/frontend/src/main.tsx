import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'
import { PolisenFilterProvider } from './context/PolisenFilterContext'
import { SavedEventsProvider } from './context/SavedEventsContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // Data anses färsk i 1 minut
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <FeatureFlagsProvider>
            <ThemeProvider>
              <PolisenFilterProvider>
                <SavedEventsProvider>
                  <App />
                </SavedEventsProvider>
              </PolisenFilterProvider>
            </ThemeProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
