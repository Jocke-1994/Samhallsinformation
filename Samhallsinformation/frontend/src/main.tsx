import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'

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
              <App />
            </ThemeProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
