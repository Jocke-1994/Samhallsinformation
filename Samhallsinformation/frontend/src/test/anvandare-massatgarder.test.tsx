import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminUserDto } from '../api/adminUsers'

// Regressionstester för V2-3 (E6#1 frontend-delen, E6#2): massåtgärder i
// Användare-listan. "Markera alla" ska undanta den inloggade adminen och
// Admin-konton, och en massåtgärd ska ge ett per-rad-resultat (allSettled) i
// stället för att ett enda fel får hela körningen att se ut som att inget hände.

const DTO = (id: string, name: string, over: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id, name, email: `${name.toLowerCase()}@example.com`, role: 'Användare', isActive: true,
  suspendedAt: null, suspendedReason: null, suspensionReminderAt: null, suspensionReminderNote: null,
  authProvider: 'password', createdAt: '2026-01-01T00:00:00Z', deletedAt: null, deletionScheduledAt: null,
  ...over,
})

const ADAM  = DTO('u-adam',  'Adam',  { role: 'Admin' })   // den inloggade adminen
const EVA   = DTO('u-eva',   'Eva',   { role: 'Admin' })   // ett annat Admin-konto
const ANNA  = DTO('u-anna',  'Anna')
const BERTIL = DTO('u-bertil', 'Bertil')
const CECILIA = DTO('u-cecilia', 'Cecilia')

const hämtaAnvändare = vi.fn()
const sättStatus     = vi.fn()
const raderaKonto    = vi.fn()

vi.mock('../api/adminUsers', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/adminUsers')>()
  return {
    ...orig,
    fetchAdminUsers: () => hämtaAnvändare(),
    setAdminUserStatus: (...args: unknown[]) => sättStatus(...args),
    deleteAdminUser: (id: string) => raderaKonto(id),
    fetchUserNotifications: async () => [],
    fetchAdminUserSavedEvents: async () => [],
    fetchAdminUserPolisenBevakningar: async () => [],
    fetchAdminUserNotificationLog: async () => [],
    fetchAdminUserSettingLog: async () => [],
    fetchAdminUserSources: async () => [],
    fetchAdminUserPushSettings: async () => ({ pushEnabled: true, pushNyaHandelser: true, pushNyVersion: true, enheter: [] }),
  }
})
vi.mock('../api/support', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/support')>()
  return { ...orig, fetchAdminTickets: async () => [] }
})
vi.mock('../api/activityLog', () => ({ createActivityLogEntry: vi.fn() }))
vi.mock('../api/events', () => ({ checkEventLinkStatus: vi.fn() }))
vi.mock('../api/eventSearch', () => ({ searchEvents: vi.fn() }))
// Adam är inloggad (versaler i e-posten: jämförelsen ska vara skiftlägesokänslig).
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ aktivVy: 'Admin', email: 'ADAM@example.com' }) }))

const { default: Anvandare } = await import('../components/Admin/Anvandare')

function visa() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Anvandare />
    </QueryClientProvider>,
  )
}

const rubrikCheckbox = () => screen.getByRole('checkbox', { name: 'Markera alla' }) as HTMLInputElement
const radCheckbox = (namn: string) => screen.getByRole('checkbox', { name: `Markera ${namn}` }) as HTMLInputElement
const väntaPåLista = () => screen.findByText('Anna')
// Modalens ruta: rubriken sitter i en header inuti rutan som ligger i den fasta overlayn.
const modal = (rubrik: string) => screen.getByText(rubrik).closest('.fixed') as HTMLElement

function markeraAlla() {
  fireEvent.click(rubrikCheckbox())
}
function öppnaMassModal(knapp: 'Stäng av' | 'Radera') {
  // Verktygsfältets knapp (modalen finns inte än).
  fireEvent.click(screen.getByRole('button', { name: knapp }))
}

beforeEach(() => {
  hämtaAnvändare.mockReset().mockResolvedValue([ADAM, EVA, ANNA, BERTIL, CECILIA])
  sättStatus.mockReset().mockResolvedValue(undefined)
  raderaKonto.mockReset().mockResolvedValue(undefined)
})

describe('Markera alla', () => {
  it('väljer inte egen rad eller Admin-konton', async () => {
    visa()
    await väntaPåLista()

    markeraAlla()

    expect(radCheckbox('Anna').checked).toBe(true)
    expect(radCheckbox('Bertil').checked).toBe(true)
    expect(radCheckbox('Cecilia').checked).toBe(true)
    expect(radCheckbox('Adam').checked).toBe(false) // egen rad
    expect(radCheckbox('Eva').checked).toBe(false)  // annat Admin-konto
    expect(screen.getByText('3 markerade')).toBeInTheDocument()
  })

  it('egen rad är inaktiverad med förklaring och går inte att markera', async () => {
    visa()
    await väntaPåLista()

    const egen = radCheckbox('Adam')
    expect(egen).toBeDisabled()
    expect(egen).toHaveAttribute('title', expect.stringContaining('ditt eget konto'))
    fireEvent.click(egen)
    expect(radCheckbox('Adam').checked).toBe(false)
    expect(screen.queryByText(/markerade/)).not.toBeInTheDocument()
  })

  it('ett Admin-konto kan fortfarande markeras individuellt', async () => {
    visa()
    await väntaPåLista()

    fireEvent.click(radCheckbox('Eva'))
    expect(radCheckbox('Eva').checked).toBe(true)
  })

  it('rubrikcheckboxens läge stämmer med det som faktiskt kan markeras', async () => {
    visa()
    await väntaPåLista()

    // Inget markerat.
    expect(rubrikCheckbox().checked).toBe(false)
    expect(rubrikCheckbox().indeterminate).toBe(false)

    // Några markerade: indeterminate, inte ikryssad.
    fireEvent.click(radCheckbox('Anna'))
    expect(rubrikCheckbox().checked).toBe(false)
    expect(rubrikCheckbox().indeterminate).toBe(true)

    // Alla markerbara markerade: ikryssad trots att egen rad + Admin-konton är omarkerade.
    fireEvent.click(radCheckbox('Bertil'))
    fireEvent.click(radCheckbox('Cecilia'))
    expect(rubrikCheckbox().checked).toBe(true)
    expect(rubrikCheckbox().indeterminate).toBe(false)

    // Ett individuellt markerat Admin-konto ändrar inte rubrikens läge.
    fireEvent.click(radCheckbox('Eva'))
    expect(rubrikCheckbox().checked).toBe(true)

    // Ett klick på rubriken avmarkerar de massmarkerbara.
    fireEvent.click(rubrikCheckbox())
    expect(radCheckbox('Anna').checked).toBe(false)
    expect(radCheckbox('Bertil').checked).toBe(false)
    expect(radCheckbox('Cecilia').checked).toBe(false)
    expect(rubrikCheckbox().checked).toBe(false)
    expect(rubrikCheckbox().indeterminate).toBe(false) // Eva är kvar markerad men räknas inte i rubriken
  })

  it('rubrikcheckboxen är inaktiverad när inget går att massmarkera', async () => {
    hämtaAnvändare.mockResolvedValue([ADAM, EVA])
    visa()
    await screen.findByText('Eva')

    expect(rubrikCheckbox()).toBeDisabled()
    expect(rubrikCheckbox().checked).toBe(false)
  })
})

describe('Massavstängning', () => {
  it('2 av 3 lyckas: listan hämtas om, lyckade avmarkeras och sammanfattningen visar orsaken', async () => {
    sättStatus.mockImplementation(async (id: string) => {
      if (id === 'u-bertil') throw new Error('Sista aktiva administratören')
    })
    visa()
    await väntaPåLista()
    markeraAlla()
    expect(hämtaAnvändare).toHaveBeenCalledTimes(1)

    öppnaMassModal('Stäng av')
    fireEvent.click(within(modal('Stäng av konto')).getByRole('button', { name: 'Stäng av' }))

    await screen.findByText('2 av 3 lyckades.')
    // Alla tre försöken skickades trots att ett av dem föll.
    expect(sättStatus).toHaveBeenCalledTimes(3)
    // Listan hämtades om även vid delvis fel.
    await waitFor(() => expect(hämtaAnvändare).toHaveBeenCalledTimes(2))
    // Felet per rad, med serverns orsak.
    expect(screen.getByText('Bertil — Sista aktiva administratören')).toBeInTheDocument()
    // Modalen behålls med resultatlistan.
    expect(screen.getByTestId('mass-resultat')).toBeInTheDocument()
    // Bara den misslyckade raden är kvar markerad.
    expect(radCheckbox('Anna').checked).toBe(false)
    expect(radCheckbox('Cecilia').checked).toBe(false)
    expect(radCheckbox('Bertil').checked).toBe(true)
    expect(screen.getByText('1 markerade')).toBeInTheDocument()

    // "Stäng" stänger modalen.
    fireEvent.click(screen.getByRole('button', { name: 'Stäng' }))
    expect(screen.queryByText('Stäng av konto')).not.toBeInTheDocument()
  })

  it('alla lyckas: modalen stängs, markeringen rensas och listan hämtas om', async () => {
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Stäng av')
    fireEvent.click(within(modal('Stäng av konto')).getByRole('button', { name: 'Stäng av' }))

    await waitFor(() => expect(screen.queryByText('Stäng av konto')).not.toBeInTheDocument())
    expect(hämtaAnvändare).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('mass-resultat')).not.toBeInTheDocument()
    expect(screen.queryByText(/markerade/)).not.toBeInTheDocument()
    expect(radCheckbox('Anna').checked).toBe(false)
  })

  it('alla misslyckas: felen visas per rad och alla förblir markerade', async () => {
    sättStatus.mockRejectedValue(new Error('Du kan inte stänga av dig själv'))
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Stäng av')
    fireEvent.click(within(modal('Stäng av konto')).getByRole('button', { name: 'Stäng av' }))

    await screen.findByText('0 av 3 lyckades.')
    expect(screen.getByText('Anna — Du kan inte stänga av dig själv')).toBeInTheDocument()
    expect(screen.getByText('Bertil — Du kan inte stänga av dig själv')).toBeInTheDocument()
    expect(screen.getByText('Cecilia — Du kan inte stänga av dig själv')).toBeInTheDocument()
    await waitFor(() => expect(hämtaAnvändare).toHaveBeenCalledTimes(2))
    expect(screen.getByText('3 markerade')).toBeInTheDocument()
  })
})

describe('Massradering', () => {
  it('bekräftelsen visar antal och namn', async () => {
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Radera')

    expect(screen.getByTestId('radera-namnlista')).toHaveTextContent('Du håller på att radera 3 konton: Anna, Bertil, Cecilia.')
    expect(raderaKonto).not.toHaveBeenCalled()
  })

  it('bekräftelsen visar bara de första fem namnen och "och N till"', async () => {
    const många = Array.from({ length: 7 }, (_, i) => DTO(`u-${i}`, `Person${i + 1}`))
    hämtaAnvändare.mockResolvedValue([ADAM, ...många])
    visa()
    await screen.findByText('Person1')
    markeraAlla()

    öppnaMassModal('Radera')

    expect(screen.getByTestId('radera-namnlista')).toHaveTextContent(
      'Du håller på att radera 7 konton: Person1, Person2, Person3, Person4, Person5 och 2 till.',
    )
  })

  it('2 av 3 lyckas: refetch, lyckade avmarkeras och den misslyckade visas med orsak', async () => {
    raderaKonto.mockImplementation(async (id: string) => {
      if (id === 'u-cecilia') throw new Error('Kontot är redan raderat.')
    })
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Radera')
    fireEvent.click(within(modal('Radera konto')).getByRole('button', { name: 'Radera permanent' }))

    await screen.findByText('2 av 3 lyckades.')
    expect(raderaKonto).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(hämtaAnvändare).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Cecilia — Kontot är redan raderat.')).toBeInTheDocument()
    expect(radCheckbox('Anna').checked).toBe(false)
    expect(radCheckbox('Bertil').checked).toBe(false)
    expect(radCheckbox('Cecilia').checked).toBe(true)
    expect(screen.getByText('1 markerade')).toBeInTheDocument()
  })

  it('alla lyckas: modalen stängs', async () => {
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Radera')
    fireEvent.click(within(modal('Radera konto')).getByRole('button', { name: 'Radera permanent' }))

    await waitFor(() => expect(screen.queryByText('Radera konto')).not.toBeInTheDocument())
    expect(hämtaAnvändare).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/markerade/)).not.toBeInTheDocument()
  })

  it('alla misslyckas: felen visas per rad', async () => {
    raderaKonto.mockRejectedValue(new Error('Du kan inte radera ditt eget konto'))
    visa()
    await väntaPåLista()
    markeraAlla()

    öppnaMassModal('Radera')
    fireEvent.click(within(modal('Radera konto')).getByRole('button', { name: 'Radera permanent' }))

    await screen.findByText('0 av 3 lyckades.')
    expect(screen.getAllByText(/— Du kan inte radera ditt eget konto/)).toHaveLength(3)
    expect(screen.getByText('3 markerade')).toBeInTheDocument()
  })
})
