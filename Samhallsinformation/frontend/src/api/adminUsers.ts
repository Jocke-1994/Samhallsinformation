import { adminFetch } from './adminFetch'

export interface AdminUserDto {
  id:              string
  name:            string
  email:           string
  role:            string
  isActive:        boolean
  suspendedAt:     string | null
  suspendedReason: string | null
  authProvider:    string
  createdAt:       string
}

export async function fetchAdminUsers(): Promise<AdminUserDto[]> {
  const res = await adminFetch('/api/admin/users')
  if (!res.ok) throw new Error(`fetchAdminUsers: ${res.status}`)
  return res.json()
}

export async function setAdminUserStatus(id: string, isActive: boolean, reason?: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ isActive, reason }),
  })
  if (!res.ok) throw new Error(`setAdminUserStatus: ${res.status}`)
}
