import { adminFetch } from './adminFetch'

export interface MeDto {
  email:         string
  name:          string
  displayName:   string | null
  role:          string
  emailVerified: boolean
}

export async function fetchMe(): Promise<MeDto> {
  const res = await adminFetch('/api/auth/me')
  if (!res.ok) throw new Error(`fetchMe: ${res.status}`)
  return res.json()
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const res = await adminFetch('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ displayName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `updateDisplayName: ${res.status}`)
  }
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `verifyEmail: ${res.status}`)
  }
}

export async function resendVerification(): Promise<void> {
  const res = await adminFetch('/api/auth/resend-verification', { method: 'POST' })
  if (!res.ok) throw new Error(`resendVerification: ${res.status}`)
}
