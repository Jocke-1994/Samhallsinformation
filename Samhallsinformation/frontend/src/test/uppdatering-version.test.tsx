import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Uppdatering } from '../api/uppdateringar'

// Versionsnummer på uppdateringar (beslut 2026-11-02, inloggningen = 1.0).

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: false }) }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => ({}) }))

const { default: SenasteUppdateringKort } =
  await import('../components/Uppdateringar/SenasteUppdateringKort')
const { default: VersionsBricka } = await import('../components/Uppdateringar/VersionsBricka')
const { VadArNyttInnehall } = await import('../components/common/VadArNytt')

describe('Versionsbrickan', () => {
  it('visar "v" + numret', () => {
    render(<VersionsBricka version=" 1.1 " />)
    expect(screen.getByText('v1.1')).toBeInTheDocument()
  })

  it('visas inte alls utan version (äldre poster)', () => {
    const { container } = render(
      <>
        <VersionsBricka version={null} />
        <VersionsBricka version="  " />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('syns på Senaste-kortet och i Vad är nytt-rutan', () => {
    render(
      <MemoryRouter>
        <SenasteUppdateringKort
          titel="Push-notiser"
          datum="2026-11-06T00:00:00Z"
          punkter={[]}
          version="1.2"
        />
        <VadArNyttInnehall
          titel="Push-notiser"
          datum="2026-11-06T00:00:00Z"
          punkter={[]}
          version="1.2"
          onStäng={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('v1.2')).toHaveLength(2)
  })
})

// Typen ska bära versionen hela vägen — kompileras bara om fältet finns.
export const _typkontroll: Pick<Uppdatering, 'version'> = { version: '1.0' }
