import { fornyaEfter401, hamtaAktuellToken } from './authBridge'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function getToken(): string | null {
  return hamtaAktuellToken()
}

// Body får vara en funktion som byggs om vid varje försök. Behövs när innehållet
// beror på sessionen (t.ex. changePassword skickar enhetens refresh-token, som
// roteras av en förnyelse mellan första försöket och omförsöket).
export type AdminInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null | (() => BodyInit | null)
}

function skicka(path: string, init: AdminInit | undefined, token: string | null): Promise<Response> {
  const body = typeof init?.body === 'function' ? init.body() : init?.body
  return fetch(`${API_BASE}${path}`, {
    ...init,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

// Alla auktoriserade anrop i src/api/ går via den här funktionen. Vid 401 med
// en skickad token förnyas sessionen EN gång (delad single-flight-refresh) och
// anropet görs om EN gång med den nya token. Är svaret fortfarande 401, eller
// gick förnyelsen inte att genomföra, returneras 401-svaret som det är — ingen
// loop och ingen utloggning här (AuthProvider avgör det, se refreshPolicy).
export async function adminFetch(path: string, init?: AdminInit): Promise<Response> {
  const token = hamtaAktuellToken()
  const res = await skicka(path, init, token)
  if (res.status !== 401 || !token) return res

  const nyToken = await fornyaEfter401(token)
  if (!nyToken) return res
  return skicka(path, init, nyToken)
}
