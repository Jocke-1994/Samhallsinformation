import { adminFetch } from './adminFetch'

export interface MeDto {
  email:         string
  name:          string
  displayName:   string | null
  role:          string
  emailVerified: boolean
  pendingEmail:  string | null
  authProvider:  string
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

export async function updateMyProfile(fields: { name?: string }): Promise<{ accessToken: string }> {
  const res = await adminFetch('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `updateMyProfile: ${res.status}`)
  }
  return res.json()
}

// Byter inte e-posten direkt — skickar en bekräftelselänk till den nya
// adressen. Kontots e-post ändras först när länken klickas (confirmEmailChange).
// currentPassword krävs för lösenordskonton (kollas av backend) — en kapad
// inloggad session ska inte ensam räcka för att byta bort kontots e-post.
export async function requestEmailChange(newEmail: string, currentPassword?: string): Promise<void> {
  const res = await adminFetch('/api/auth/me/email-change', {
    method: 'POST',
    body: JSON.stringify({ newEmail, currentPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `requestEmailChange: ${res.status}`)
  }
}

export async function cancelEmailChange(): Promise<void> {
  const res = await adminFetch('/api/auth/me/email-change', { method: 'DELETE' })
  if (!res.ok) throw new Error(`cancelEmailChange: ${res.status}`)
}

export async function confirmEmailChange(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/confirm-email-change', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `confirmEmailChange: ${res.status}`)
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

// Kräver ingen inloggning (kontot är spärrat under raderingsfönstret) —
// token:et i länken är i sig beviset på identitet.
export async function cancelDeletion(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/cancel-deletion', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `cancelDeletion: ${res.status}`)
  }
}

// Formen matchar AuthController.ExportMe rakt av — konsumeras bara för att
// serialiseras tillbaka till en nedladdningsbar JSON-fil, ingen anledning
// att typa varje nästlat fält i detalj.
export async function exportMyData(): Promise<Record<string, unknown>> {
  const res = await adminFetch('/api/auth/me/export')
  if (!res.ok) throw new Error(`exportMyData: ${res.status}`)
  return res.json()
}

export async function deleteMyAccount(): Promise<{ deletionScheduledAt: string }> {
  const res = await adminFetch('/api/auth/me', { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `deleteMyAccount: ${res.status}`)
  }
  return res.json()
}
