import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ADMIN_NAV, effektivAdminRoll, startSektion, tillåtnaSektioner,
} from '../lib/adminNavigering'

// V3-10 (beslut D1): Support-rollens menyer ska stämma med backend. Support ser bara
// Support-inbox (startsida), Användare (skrivskyddat) och Händelsesök; inga flikar som ger
// 403. Admin ser allt, oförändrat.

const SUPPORT_MENY = ['Användare', 'Support-inbox', 'Händelsesök']
const ADMIN_MENY = [
  'Översikt', 'Källhantering', 'Sandlåda', 'Uppdateringar', 'FAQ-hantering', 'Användare', 'Support-inbox',
  'Händelsesök', 'Aktivitetslogg', 'Rapporter', 'Felsökning', 'Impersonation', 'Feature flags', 'Funktionsidéer',
]

describe('adminNavigering', () => {
  it('Support når exakt Användare, Support-inbox och Händelsesök', () => {
    expect([...tillåtnaSektioner('Support')].sort()).toEqual(['anvandare', 'handelsesok', 'support-inbox'])
  })

  it('Admin når alla sektioner', () => {
    expect(tillåtnaSektioner('Admin')).toHaveLength(ADMIN_NAV.length)
    expect(tillåtnaSektioner('Admin')).toHaveLength(14)
  })

  it('Support startar i Support-inbox, Admin i Översikt', () => {
    expect(startSektion('Support')).toBe('support-inbox')
    expect(startSektion('Admin')).toBe('oversikt')
    // Startsektionen måste vara en sektion rollen får se.
    expect(tillåtnaSektioner('Support')).toContain(startSektion('Support'))
    expect(tillåtnaSektioner('Admin')).toContain(startSektion('Admin'))
  })

  it('ett riktigt Support-konto är Support oavsett sparad vy; en Admin i Support-vyn förhandsvisar Support', () => {
    expect(effektivAdminRoll('Support', 'Support')).toBe('Support')
    expect(effektivAdminRoll('Support', 'Admin')).toBe('Support') // gammal si_aktiv_vy från en admin-session
    expect(effektivAdminRoll('Admin', 'Support')).toBe('Support')
    expect(effektivAdminRoll('Admin', 'Admin')).toBe('Admin')
    expect(effektivAdminRoll('Admin', 'Användare')).toBe('Admin')
  })
})

// --- Sidomenyn -------------------------------------------------------------------------------------

const { default: AdminSidebar } = await import('../components/Admin/AdminSidebar')

// Knappen är [ikon][etikett][ev. olästa-bubbla] i tre <span>; etiketten är den andra.
const etikett = (b: HTMLElement) => b.querySelectorAll('span')[1]?.textContent

function sidomeny(roll: 'Admin' | 'Support') {
  render(
    <MemoryRouter>
      <AdminSidebar active="oversikt" onSelect={() => {}} roll={roll} isOpen onClose={() => {}} />
    </MemoryRouter>,
  )
  const nav = screen.getAllByRole('navigation')[0]
  return within(nav).getAllByRole('button').map(etikett)
}

describe('AdminSidebar', () => {
  it('Support ser bara de tre tillåtna flikarna', () => {
    expect(sidomeny('Support')).toEqual(SUPPORT_MENY)
  })

  it('Admin ser alla flikar (oförändrat)', () => {
    expect(sidomeny('Admin')).toEqual(ADMIN_MENY)
  })
})

// --- AdminPage: startsida och sektionsvakt ----------------------------------------------------------

const auth = vi.hoisted(() => ({
  värde: { isLoggedIn: true, roll: 'Admin', aktivVy: 'Admin', name: 'Test', email: 'x@example.com', byttVy: () => {} },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.värde }))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFeatureFlagsAdmin: () => ({ flaggor: {}, inställda: {}, växlaFlagg: () => {}, återställ: () => {} }),
}))
vi.mock('../hooks/usePwaIdentity', () => ({ usePwaIdentity: () => {}, ADMIN_PWA_IDENTITET: {} }))
vi.mock('../hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({ isSubscribed: false, loading: false, subscribe: async () => {}, unsubscribe: async () => {} }),
  isPushSupported: () => false,
}))
vi.mock('../api/push', () => ({
  fetchPushSettings: async () => ({ pushEnabled: true }),
  savePushSettings: async () => {},
}))
const hämtaÄrendenFörBadge = vi.fn()
vi.mock('../api/support', () => ({
  fetchAdminTickets: () => hämtaÄrendenFörBadge(),
  fetchSupportNotifications: async () => [],
}))
vi.mock('../api/adminUsers', () => ({ fetchUserNotifications: async () => [] }))

// Sektionerna är tunga och testas för sig — här räcker en stub som visar vilken som renderats.
function stub(namn: string) {
  return { default: () => <div data-testid="sektion">{namn}</div> }
}
vi.mock('../components/Admin/Oversikt', () => stub('Översikt-innehåll'))
vi.mock('../components/Admin/Kallhantering', () => stub('Källhantering-innehåll'))
vi.mock('../components/Admin/Felsökning', () => stub('Felsökning-innehåll'))
vi.mock('../components/Admin/Anvandare', () => stub('Användare-innehåll'))
vi.mock('../components/Admin/SupportInbox', () => stub('Inbox-innehåll'))
vi.mock('../components/Admin/Rapporter', () => stub('Rapporter-innehåll'))
vi.mock('../components/Admin/Aktivitetslogg', () => stub('Aktivitetslogg-innehåll'))
vi.mock('../components/Admin/Impersonation', () => stub('Impersonation-innehåll'))
vi.mock('../components/Admin/AdminUppdateringar', () => stub('Uppdateringar-innehåll'))
vi.mock('../components/Admin/AdminFaq', () => stub('FAQ-innehåll'))
vi.mock('../components/Admin/FeatureFlagsAdmin', () => stub('Flaggor-innehåll'))
vi.mock('../components/Admin/SiteSettingsAdmin', () => stub('Sajtinställningar-innehåll'))
vi.mock('../components/Admin/MaintenanceBannerAdmin', () => stub('Driftbanderoll-innehåll'))
vi.mock('../components/Admin/FunktionsIdePipeline', () => stub('Idéer-innehåll'))
vi.mock('../components/Admin/Sandlada', () => stub('Sandlåda-innehåll'))
vi.mock('../components/Admin/Handelsesok', () => stub('Händelsesök-innehåll'))

const { default: AdminPage } = await import('../pages/AdminPage')

function visaAdminPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sektioner = () => screen.queryAllByTestId('sektion').map(e => e.textContent)
const menyNamn = () => {
  const nav = screen.getAllByRole('navigation')[0]
  return within(nav).getAllByRole('button').map(etikett)
}
const rubrik = () => screen.getByRole('heading', { level: 1 }).textContent

beforeEach(() => {
  auth.värde = { isLoggedIn: true, roll: 'Admin', aktivVy: 'Admin', name: 'Test', email: 'x@example.com', byttVy: () => {} }
  hämtaÄrendenFörBadge.mockReset().mockResolvedValue([])
})

describe('AdminPage', () => {
  it('Support landar i Support-inbox och ser bara sina tre flikar', async () => {
    auth.värde = { ...auth.värde, roll: 'Support', aktivVy: 'Support' }
    visaAdminPage()

    expect(rubrik()).toBe('Support-inbox')
    expect(sektioner()).toEqual(['Inbox-innehåll'])
    expect(menyNamn()).toEqual(SUPPORT_MENY)
    // Ingen admin-only flik finns att klicka på.
    for (const namn of ['Källhantering', 'Felsökning', 'Aktivitetslogg', 'Feature flags', 'Impersonation', 'Översikt']) {
      expect(screen.queryByRole('button', { name: new RegExp(namn) })).toBeNull()
    }
  })

  it('Support kan bläddra mellan sina flikar', async () => {
    auth.värde = { ...auth.värde, roll: 'Support', aktivVy: 'Support' }
    visaAdminPage()

    fireEvent.click(screen.getByRole('button', { name: /Användare/ }))
    expect(sektioner()).toEqual(['Användare-innehåll'])
    fireEvent.click(screen.getByRole('button', { name: /Händelsesök/ }))
    expect(sektioner()).toEqual(['Händelsesök-innehåll'])
  })

  it('ett Support-konto med en gammal Admin-vy i localStorage får ändå Support-menyerna och aldrig en admin-sektion', async () => {
    auth.värde = { ...auth.värde, roll: 'Support', aktivVy: 'Admin' }
    visaAdminPage()

    expect(rubrik()).toBe('Support-inbox')
    expect(menyNamn()).toEqual(SUPPORT_MENY)
    // Varken Översikt eller någon annan admin-sektion har renderats (skulle ge 403-anrop).
    expect(sektioner()).toEqual(['Inbox-innehåll'])
  })

  it('Admin landar i Översikt och ser alla flikar (oförändrat)', async () => {
    visaAdminPage()

    expect(rubrik()).toBe('Översikt')
    expect(sektioner()).toEqual(['Översikt-innehåll'])
    expect(menyNamn()).toEqual(ADMIN_MENY)
  })

  it('en Admin som byter till Support-vyn flyttas till Support-inbox och ser Support-menyerna', async () => {
    const { rerender } = visaAdminPage()
    fireEvent.click(screen.getByRole('button', { name: /Källhantering/ }))
    expect(sektioner()).toEqual(['Källhantering-innehåll'])

    auth.värde = { ...auth.värde, aktivVy: 'Support' }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AdminPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })

    expect(rubrik()).toBe('Support-inbox')
    expect(sektioner()).toEqual(['Inbox-innehåll'])
    expect(menyNamn()).toEqual(SUPPORT_MENY)
  })
})
