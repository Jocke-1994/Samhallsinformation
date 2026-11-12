import type { SystemRoll } from '../context/AuthContext'

// Vilka vyer ett konto får välja mellan (samma tabell som vyväljaren i
// Sidebar och AdminPage visar). Backend avgör alltid själv vad kontot får
// göra — vyn styr bara vad gränssnittet visar.
const TILLATNA_VYER: Record<SystemRoll, SystemRoll[]> = {
  Admin: ['Admin', 'Support', 'Användare'],
  Support: ['Support', 'Användare'],
  Användare: ['Användare'],
}

export function arVyTillaten(vy: string | null | undefined, roll: SystemRoll): vy is SystemRoll {
  return vy != null && (TILLATNA_VYER[roll] as string[]).includes(vy)
}

// Aktiv vy efter att en token satts: en redan vald vy behålls så länge den
// fortfarande är giltig för kontots roll (annars hoppade en admins Support-vy
// tillbaka vid varje tokenförnyelse). Saknad eller ogiltig vy -> rollen.
export function valjAktivVy(lagrad: string | null | undefined, roll: SystemRoll): SystemRoll {
  return arVyTillaten(lagrad, roll) ? lagrad : roll
}
