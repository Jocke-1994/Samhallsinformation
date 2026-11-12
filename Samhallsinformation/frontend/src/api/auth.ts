import { adminFetch } from './adminFetch'
import { LANG_TIMEOUT_MS, felFranSvar } from './hamta'

export interface MeDto {
  email: string
  name: string
  displayName: string | null
  role: string
  emailVerified: boolean
  pendingEmail: string | null
  authProvider: string
}

export async function fetchMe(): Promise<MeDto> {
  const res = await adminFetch('/api/auth/me')
  if (!res.ok) throw await felFranSvar(res, 'fetchMe')
  return res.json()
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const res = await adminFetch('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ displayName }),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'updateDisplayName')
  }
}

export async function updateMyProfile(fields: { name?: string }): Promise<{ accessToken: string }> {
  const res = await adminFetch('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'updateMyProfile')
  }
  return res.json()
}

// Byter lösenord för det inloggade kontot (PUT /api/auth/me/password). Backend
// återkallar kontots övriga sessioner; enhetens egen refresh-token skickas med
// så att just den sessionen behålls. Felen är redan skrivna på svenska för
// UI:t: 400 bär serverns egen text (fel nuvarande lösenord, för kort nytt
// lösenord, Google-konto), övriga statusar och nätverksfel får en generell text.
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  let res: Response
  try {
    res = await adminFetch('/api/auth/me/password', {
      method: 'PUT',
      // Funktion, inte sträng: får anropet 401 förnyas sessionen och
      // refresh-token roteras — omförsöket måste skicka den NYA, annars
      // återkallar backend enhetens egen session tillsammans med de övriga.
      body: () =>
        JSON.stringify({
          currentPassword,
          newPassword,
          refreshToken: localStorage.getItem('si_refresh_token'),
        }),
    })
  } catch {
    throw new Error('Kunde inte nå servern. Kontrollera din anslutning och försök igen.')
  }
  if (res.ok) return

  const err = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.status === 400 && err.error) throw new Error(err.error)
  if (res.status === 401)
    throw new Error('Din session har gått ut. Logga in igen och försök på nytt.')
  if (res.status === 429)
    throw new Error('För många försök på kort tid. Vänta en minut och försök igen.')
  throw new Error('Något gick fel när lösenordet skulle bytas. Försök igen om en stund.')
}

// Byter inte e-posten direkt — skickar en bekräftelselänk till den nya
// adressen. Kontots e-post ändras först när länken klickas (confirmEmailChange).
// currentPassword krävs för lösenordskonton (kollas av backend) — en kapad
// inloggad session ska inte ensam räcka för att byta bort kontots e-post.
export async function requestEmailChange(
  newEmail: string,
  currentPassword?: string,
): Promise<void> {
  const res = await adminFetch('/api/auth/me/email-change', {
    method: 'POST',
    body: JSON.stringify({ newEmail, currentPassword }),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'requestEmailChange')
  }
}

export async function cancelEmailChange(): Promise<void> {
  const res = await adminFetch('/api/auth/me/email-change', { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'cancelEmailChange')
}

export async function confirmEmailChange(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/confirm-email-change', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'confirmEmailChange')
  }
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'verifyEmail')
  }
}

export async function resendVerification(): Promise<void> {
  const res = await adminFetch('/api/auth/resend-verification', { method: 'POST' })
  if (!res.ok) throw await felFranSvar(res, 'resendVerification')
}

// Kräver ingen inloggning (kontot är spärrat under raderingsfönstret) —
// token:et i länken är i sig beviset på identitet.
export async function cancelDeletion(token: string): Promise<void> {
  const res = await adminFetch('/api/auth/cancel-deletion', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    throw await felFranSvar(res, 'cancelDeletion')
  }
}

// Formen matchar AuthController.ExportMe rakt av — konsumeras bara för att
// serialiseras tillbaka till en nedladdningsbar JSON-fil, ingen anledning
// att typa varje nästlat fält i detalj.
export async function exportMyData(): Promise<Record<string, unknown>> {
  const res = await adminFetch('/api/auth/me/export', { timeoutMs: LANG_TIMEOUT_MS })
  if (!res.ok) throw await felFranSvar(res, 'exportMyData')
  return res.json()
}

export async function deleteMyAccount(): Promise<{ deletionScheduledAt: string }> {
  const res = await adminFetch('/api/auth/me', { method: 'DELETE' })
  if (!res.ok) {
    throw await felFranSvar(res, 'deleteMyAccount')
  }
  return res.json()
}
