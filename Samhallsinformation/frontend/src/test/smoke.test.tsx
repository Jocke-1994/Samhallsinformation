import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BetaBadge from '../components/common/BetaBadge'
import Toggle from '../components/common/Toggle'
import { FLAG_GRUPPER, isSektionSynlig, type FlagState } from '../lib/featureFlags'

// Röktest: bevisar att Vitest + jsdom + Testing Library + jest-dom + user-event
// är rätt kopplade. Inget här testar affärslogik — se feature-testerna för det.
describe('testuppsättning (rök)', () => {
  it('kör en ren funktion (isSektionSynlig)', () => {
    const grupp = FLAG_GRUPPER[0]
    const allaAv = Object.fromEntries(
      FLAG_GRUPPER.flatMap((g) => g.flaggor).map((f) => [f.key, false]),
    ) as FlagState

    expect(isSektionSynlig(grupp.key, allaAv)).toBe(false)
    expect(isSektionSynlig(grupp.key, { ...allaAv, [grupp.flaggor[0].key]: true })).toBe(true)
    // Okänd sektion visas som standard
    expect(isSektionSynlig('finns-inte', allaAv)).toBe(true)
  })

  it('renderar en komponent i jsdom med jest-dom-matchers', () => {
    render(<BetaBadge />)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('hanterar användarinteraktion via user-event', async () => {
    const paAndring = vi.fn()
    render(<Toggle on={false} onChange={paAndring} />)

    await userEvent.click(screen.getByRole('button'))

    expect(paAndring).toHaveBeenCalledExactlyOnceWith(true)
  })
})
