import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'

// AuthProvider sitter inuti QueryClientProvider i appen (main.tsx) och använder
// själv query-klienten (töm cachen vid sessionsslut) — samma nesting i testerna.
export function skapaTestKlient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })
}

export function AuthMedQuery({ children, klient }: { children: React.ReactNode; klient?: QueryClient }) {
  const [anvand] = useState(() => klient ?? skapaTestKlient())
  return (
    <QueryClientProvider client={anvand}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
