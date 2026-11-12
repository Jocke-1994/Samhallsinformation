import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { UppdateringsPunkt } from '../api/uppdateringar'

// Prova själv-länkarna i de riktiga korten (Ideer/Prova-sjalv-lankar.md).

const auth = { isLoggedIn: false }
const flaggor: Record<string, boolean> = {}
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => flaggor }))

const { default: SenasteUppdateringKort } =
  await import('../components/Uppdateringar/SenasteUppdateringKort')
const { VadArNyttInnehall } = await import('../components/common/VadArNytt')

const PUNKTER: UppdateringsPunkt[] = [
  {
    id: '1',
    typ: 'ny-funktion',
    plats: 'Nyhetsflöde',
    text: 'Filtrera på plats',
    synlighet: 'alla',
    provaSjalv: 'senaste-nytt-plats',
  },
  {
    id: '2',
    typ: 'ny-funktion',
    plats: 'Konto',
    text: 'Push-notiser',
    synlighet: 'alla',
    provaSjalv: 'konto-push',
  },
  {
    id: '3',
    typ: 'ny-funktion',
    plats: 'Konto',
    text: 'Uppdateringar i profilen',
    synlighet: 'alla',
    provaSjalv: 'profil-uppdateringar',
  },
  { id: '4', typ: 'buggfix', plats: 'Allmänt', text: 'Utan länk', synlighet: 'alla' },
]

function kort(props: Partial<Parameters<typeof SenasteUppdateringKort>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SenasteUppdateringKort titel="T" datum="2026-11-03T00:00:00Z" punkter={PUNKTER} {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.isLoggedIn = false
  for (const k of Object.keys(flaggor)) delete flaggor[k]
  Object.assign(flaggor, { flode_platsfilter: true, notif_push: true, uppdateringar_senaste: true })
})

describe('Prova själv i Senaste-kortet', () => {
  it('besökare: direktlänk där inget konto krävs, "kräver konto" via inloggningen annars', () => {
    kort()
    expect(screen.getByRole('link', { name: 'Prova själv →' })).toHaveAttribute(
      'href',
      '/?vy=plats',
    )
    const kräver = screen.getAllByRole('link', { name: /Prova själv · kräver konto/ })
    expect(kräver.map((l) => l.getAttribute('href'))).toEqual([
      '/login?redirect=%2Fprofil%3Fsection%3Dkonto',
      '/login?redirect=%2Fprofil%3Fsection%3Duppdateringar',
    ])
  })

  it('inloggad: alla länkar går direkt', () => {
    auth.isLoggedIn = true
    kort()
    expect(
      screen.getAllByRole('link', { name: 'Prova själv →' }).map((l) => l.getAttribute('href')),
    ).toEqual(['/?vy=plats', '/profil?section=konto', '/profil?section=uppdateringar'])
  })

  it('ingen länk till en avstängd funktion eller till sidan man står på', () => {
    auth.isLoggedIn = true
    flaggor.notif_push = false
    kort({ härifrån: 'profil-uppdateringar' })
    expect(
      screen.getAllByRole('link', { name: 'Prova själv →' }).map((l) => l.getAttribute('href')),
    ).toEqual(['/?vy=plats'])
  })

  it('i förhandsvisningen är länken ingen riktig länk, och följer lanseringens flaggor', () => {
    kort({ förhandsvisning: { inloggad: false, flaggor: { flode_platsfilter: true } } })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Prova själv →')).toBeInTheDocument()
    // notif_push är av i lanseringens flaggor, uppdateringar_senaste också
    expect(screen.queryByText(/kräver konto/)).not.toBeInTheDocument()
  })
})

describe('Prova själv i Vad är nytt-rutan', () => {
  it('ett klick räknas som att rutan är sedd', async () => {
    auth.isLoggedIn = true
    const stäng = vi.fn()
    render(
      <MemoryRouter>
        <VadArNyttInnehall
          titel="T"
          datum="2026-11-03T00:00:00Z"
          punkter={PUNKTER.slice(0, 1)}
          onStäng={stäng}
        />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('link', { name: 'Prova själv →' }))

    expect(stäng).toHaveBeenCalled()
  })
})
