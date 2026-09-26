import { useAuth } from '../context/AuthContext'
import type { Anvandare } from '../lib/queryNycklar'

// Identiteten som användarspecifika query-nycklar byggs av (se lib/queryNycklar).
export function useAnvandare(): Anvandare {
  return useAuth().email ?? null
}
