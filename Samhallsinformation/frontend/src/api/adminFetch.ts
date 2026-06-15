const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function getToken(): string | null {
  return localStorage.getItem('si_token')
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
