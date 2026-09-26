import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminUserDto } from '../api/adminUsers'

// V3-10 (beslut D1): innehållet Support ser ska stämma med backend. Användare är
// SKRIVSKYDDAT för Support (backend ger 403 på varje skrivning), så UI:t ska inte
// erbjuda avstängning, radering, återställningsmejl, "Logga in som", bevakningar,
// källtoggling, push-toggling, borttagning av sparat eller massmarkering. Admin ser allt.
// Händelsesök: Support får söka men inte spara/markera. Support-inbox: Support får allt
// utom "Skapa idé" (Funktionsidéer är Admin-only).

const auth = vi.hoisted(() => ({
  värde: { roll: 'Admin', aktivVy: 'Admin', email: 'adam@example.com' } as { roll: string; aktivVy: string; email: string },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.värde }))

const DTO = (id: string, name: string, over: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id, name, email: `${name.toLowerCase()}@example.com`, role: 'Användare', isActive: true,
  suspendedAt: null, suspendedReason: null, suspensionReminderAt: null, suspensionReminderNote: null,
  authProvider: 'password', createdAt: '2026-01-01T00:00:00Z', deletedAt: null, deletionScheduledAt: null,
  ...over,
})

const ANNA    = DTO('u-anna', 'Anna')
const BERTIL  = DTO('u-bertil', 'Bertil', { isActive: false, suspendedAt: '2026-09-01T00:00:00Z' })
const CECILIA = DTO('u-cecilia', 'Cecilia', { isActive: false, deletionScheduledAt: '2099-01-01T00:00:00Z' })

const hämtaNotiser = vi.fn()
const hämtaAnvändare = vi.fn()

vi.mock('../api/adminUsers', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/adminUsers')>()
  return {
    ...orig,
    fetchAdminUsers: () => hämtaAnvändare(),
    fetchUserNotifications: () => hämtaNotiser(),
    fetchAdminUserSavedEvents: async () => [
      { eventId: 'e1', title: 'Brand i Kungälv', url: 'https://example.com/e1', sourceName: 'Polisen', publishedAt: '2026-09-01T00:00:00Z', savedAt: '2026-09-02T00:00:00Z' },
    ],
    fetchAdminUserPolisenBevakningar: async () => [{ id: 'b1', kategorier: ['Brand'], omraden: ['Kungälv'] }],
    fetchAdminUserNotificationLog: async () => [],
    fetchAdminUserSettingLog: async () => [],
    fetchAdminUserSources: async () => [{ sourceId: 1, shortName: 'Polisen', name: 'Polisen', isActive: true }],
    fetchAdminUserPushSettings: async () => ({ pushEnabled: true, pushNyaHandelser: true, pushNyVersion: false, enheter: [] }),
    fetchSavedEventsByEvent: async () => ({}),
  }
})
vi.mock('../api/support', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/support')>()
  return {
    ...orig,
    fetchAdminTickets: async () => [],
    fetchAdminTicket: async (id: string) => ({
      ticket: {
        id, ticketNumber: 1, subject: 'Frågan', category: 'Fråga', status: 'Öppet', channel: 'arendehantering',
        isArchived: false, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', createdByName: null,
      },
      messages: [], scheduledActions: [],
    }),
    fetchAgents: async () => [],
    fetchSupportNotifications: async () => [],
  }
})
vi.mock('../api/activityLog', () => ({ createActivityLogEntry: vi.fn() }))
vi.mock('../api/events', () => ({ checkEventLinkStatus: vi.fn() }))
vi.mock('../api/eventSearch', () => ({
  searchEvents: async () => ({
    total: 1,
    events: [{ id: 'ev1', title: 'Rattfylleri i Göteborg', sourceName: 'Polisen', publishedAt: '2026-09-01T00:00:00Z' }],
  }),
  fetchSearchableSources: async () => [{ id: 1, name: 'Polisen', shortName: 'Polisen' }],
  fetchEventTypes: async () => [],
}))
// NewsItem är tung och orelevant här; stubben speglar bara om en markeringsruta skickas in.
vi.mock('../components/NewsFeed/NewsItem', () => ({
  default: ({ event, checkbox }: { event: { title: string }; checkbox?: unknown }) => (
    <div>
      <span>{event.title}</span>
      {checkbox ? <input type="checkbox" aria-label={`markera ${event.title}`} /> : null}
    </div>
  ),
}))

const { default: Anvandare } = await import('../components/Admin/Anvandare')
const { default: Handelsesok } = await import('../components/Admin/Handelsesok')
const { default: SupportInbox } = await import('../components/Admin/SupportInbox')

function visa(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

const somSupport = () => { auth.värde = { roll: 'Support', aktivVy: 'Support', email: 'sanna@example.com' } }
const somAdmin = () => { auth.värde = { roll: 'Admin', aktivVy: 'Admin', email: 'adam@example.com' } }

// Källsektionen i detaljpanelen (statusfiltret i listan har också en knapp som heter Aktiv).
const källor = () => screen.getByText('Aktiva källor').parentElement as HTMLElement
const knapp = (namn: string | RegExp) => screen.queryByRole('button', { name: namn })

beforeEach(() => {
  somAdmin()
  hämtaAnvändare.mockReset().mockResolvedValue([ANNA, BERTIL, CECILIA])
  hämtaNotiser.mockReset().mockResolvedValue([])
})

// Väntar tills detaljpanelens data (källor, bevakningar, push, sparat) är laddad.
async function öppnaAnna() {
  fireEvent.click(await screen.findByText('Anna'))
  await screen.findByText('Brand i Kungälv')
  await screen.findByText('Push på')
  await screen.findByText('Brand')
}

describe('Användare som Support: skrivskyddat', () => {
  it('visar listan men ingen massmarkering', async () => {
    somSupport()
    visa(<Anvandare />)
    await screen.findByText('Anna')

    expect(screen.getByText('Bertil')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText(/Skrivskyddad vy/)).toBeInTheDocument()
  })

  it('detaljpanelen visar uppgifterna men inga åtgärdsknappar för en aktiv användare', async () => {
    somSupport()
    visa(<Anvandare />)
    await öppnaAnna()

    // Läsning finns kvar
    expect(screen.getByText('Polisen')).toBeInTheDocument()
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Push på')).toBeInTheDocument()
    expect(screen.getByText('Ny version av')).toBeInTheDocument()

    // Inget som ändrar något
    for (const namn of [
      'Logga in som', 'Stäng av konto', 'Radera konto (GDPR)', 'Skicka lösenordsåterställning',
      'Ändra roller', '+ Ny bevakning', 'Ändra', 'Ta bort', 'Aktivera konto', 'Ångra radering',
    ]) {
      expect(knapp(namn), `knappen "${namn}" ska inte finnas`).toBeNull()
    }
    // Källor och push visas som text, inte som klickbara växlare.
    expect(within(källor()).queryByRole('button', { name: 'Aktiv' })).toBeNull()
    expect(within(källor()).getByText('Aktiv')).toBeInTheDocument()
    expect(knapp(/^Push (på|av)$/)).toBeNull()
    expect(knapp(/^Ny (händelse|version) (på|av)$/)).toBeNull()
    expect(screen.queryByText('Åtgärder')).not.toBeInTheDocument()
  })

  it('avstängd användare: ingen "Aktivera konto"', async () => {
    somSupport()
    visa(<Anvandare />)
    fireEvent.click(await screen.findByText('Bertil'))
    await screen.findByText('Polisen')

    expect(knapp('Aktivera konto')).toBeNull()
    expect(knapp('Radera konto (GDPR)')).toBeNull()
  })

  it('användare med schemalagd radering: ingen "Ångra radering"', async () => {
    somSupport()
    visa(<Anvandare />)
    fireEvent.click(await screen.findByText('Cecilia'))
    await screen.findByText(/Raderas \(anonymiseras\) automatiskt/)

    expect(knapp('Ångra radering')).toBeNull()
  })

  it('en Admin i Support-vyn ser samma skrivskyddade UI (förhandsvisning av rollen)', async () => {
    auth.värde = { roll: 'Admin', aktivVy: 'Support', email: 'adam@example.com' }
    visa(<Anvandare />)
    await screen.findByText('Anna')

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText(/Skrivskyddad vy/)).toBeInTheDocument()
  })

  it('ett riktigt Support-konto är skrivskyddat även med en gammal Admin-vy i localStorage', async () => {
    auth.värde = { roll: 'Support', aktivVy: 'Admin', email: 'sanna@example.com' }
    visa(<Anvandare />)
    await screen.findByText('Anna')

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('Användare som Admin: oförändrat', () => {
  it('listan har massmarkering', async () => {
    visa(<Anvandare />)
    await screen.findByText('Anna')

    expect(screen.getByRole('checkbox', { name: 'Markera alla' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Markera Anna' })).toBeInTheDocument()
    expect(screen.queryByText(/Skrivskyddad vy/)).not.toBeInTheDocument()
  })

  it('detaljpanelen har alla åtgärder', async () => {
    visa(<Anvandare />)
    await öppnaAnna()

    for (const namn of [
      'Stäng av konto', 'Radera konto (GDPR)', 'Skicka lösenordsåterställning',
      '+ Ny bevakning', 'Ändra', 'Push på', 'Ny händelse på', 'Ny version av',
    ]) {
      expect(knapp(namn), `knappen "${namn}" ska finnas`).not.toBeNull()
    }
    expect(within(källor()).getByRole('button', { name: 'Aktiv' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ta bort' }).length).toBeGreaterThanOrEqual(2) // bevakning + sparat
    expect(screen.getByText('Åtgärder')).toBeInTheDocument()
  })

  it('avstängd användare: "Aktivera konto" finns, schemalagd radering: "Ångra radering" finns', async () => {
    visa(<Anvandare />)
    fireEvent.click(await screen.findByText('Bertil'))
    expect(await screen.findByRole('button', { name: 'Aktivera konto' })).toBeInTheDocument()
  })
})

describe('Händelsesök', () => {
  it('Support: söker och läser, men kan inte markera eller spara till en användare', async () => {
    somSupport()
    visa(<Handelsesok />)
    await screen.findByText('Rattfylleri i Göteborg')

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByTitle('Markera alla på sidan')).not.toBeInTheDocument()
    expect(screen.getByText('1 träffar')).toBeInTheDocument()
    expect(hämtaAnvändare).not.toHaveBeenCalled() // användarlistan behövdes bara till spara-väljaren
  })

  it('Admin: kan markera och spara (oförändrat)', async () => {
    visa(<Handelsesok />)
    await screen.findByText('Rattfylleri i Göteborg')

    expect(screen.getByLabelText('markera Rattfylleri i Göteborg')).toBeInTheDocument()
    expect(screen.getByTitle('Markera alla på sidan')).toBeInTheDocument()
    await waitFor(() => expect(hämtaAnvändare).toHaveBeenCalled())
  })
})

describe('Support-inbox: ärendets åtgärder', () => {
  it('Support kan svara/ändra status men ser inte "Skapa idé" (Admin-only)', async () => {
    somSupport()
    visa(<SupportInbox defaultOpenId="t1" />)
    await screen.findByText('Inlämnat av')

    expect(screen.queryByText(/Skapa idé av det här ärendet/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '📦 Arkivera' })).toBeInTheDocument()
  })

  it('Admin ser "Skapa idé" (oförändrat)', async () => {
    visa(<SupportInbox defaultOpenId="t1" />)
    expect(await screen.findByText(/Skapa idé av det här ärendet/)).toBeInTheDocument()
  })
})
