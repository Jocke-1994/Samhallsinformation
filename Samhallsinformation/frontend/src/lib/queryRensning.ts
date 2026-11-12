import type { QueryClient, QueryKey } from '@tanstack/react-query'

// Publika queries: samma svar oavsett vem som är inloggad, så de behålls vid
// utloggning (annars blinkar t.ex. källistan i sidomenyn tom tills den hämtats
// om). Allt annat räknas som användarspecifikt och rensas — en NY nyckel som
// någon glömmer lägga till här rensas alltså i stället för att läcka mellan
// användare på samma enhet (säker standard).
const PUBLIKA_NYCKLAR = new Set([
  'sources',
  'faq',
  'events',
  'site-settings',
  'feature-flags',
  'maintenance-banners',
])

function arPublik(nyckel: QueryKey): boolean {
  const forsta = nyckel[0]
  if (typeof forsta !== 'string') return false
  if (forsta === 'uppdateringar') return nyckel[1] === 'anonym'
  return PUBLIKA_NYCKLAR.has(forsta)
}

// Tar bort all användarspecifik data ur react-query-cachen och avbryter
// pågående hämtningar för den (så att en sen respons från den förra användaren
// inte hamnar i cachen efteråt). Körs när sessionen tar slut.
export function rensaAnvandardata(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (q) => !arPublik(q.queryKey) })
}
