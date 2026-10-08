import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import Banderoll from '../components/common/Banderoll'
import { bannerAvtryck, arInternSokvag } from '../lib/banderoll'
import type { MaintenanceBanner } from '../api/maintenanceBanners'

// Nyhetsbanderollen (Drift/Nyhet/Kommande + rubrik + "Läs mer") — se
// Verktyg/Schemalagd-lansering i valvet.

function banner(över: Partial<MaintenanceBanner> = {}): MaintenanceBanner {
  return {
    id: 'b1',
    message: 'Filtrera på plats',
    startUtc: '2026-10-15T07:00:00Z',
    endUtc: '2026-10-22T07:00:00Z',
    audience: 'Alla',
    stil: 'Drift',
    rubrik: null,
    lankUrl: null,
    ...över,
  }
}

function visa(b: MaintenanceBanner) {
  return render(<MemoryRouter><Banderoll banner={b} /></MemoryRouter>)
}

describe('Banderoll', () => {
  beforeEach(() => localStorage.clear())

  it('vanlig driftbanderoll visar bara meddelandet, orange, utan länk', () => {
    const { container } = visa(banner({ message: 'Planerat underhåll' }))
    expect(screen.getByText('Planerat underhåll')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.firstElementChild?.className).toContain('bg-orange-600')
  })

  it('nyhetsbanderoll visar rubrik, meddelande och Läs mer-länk, violett', () => {
    const { container } = visa(banner({ stil: 'Nyhet', rubrik: 'Nytt på Samhällsinformation', lankUrl: '/uppdateringar' }))
    expect(screen.getByText('Nytt på Samhällsinformation')).toBeInTheDocument()
    expect(screen.getByText('Filtrera på plats')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Läs mer' })).toHaveAttribute('href', '/uppdateringar')
    expect(container.firstElementChild?.className).toContain('bg-violet-700')
  })

  it('kommande-banderoll är grön', () => {
    const { container } = visa(banner({ stil: 'Kommande', rubrik: 'Kommer 15 oktober' }))
    expect(container.firstElementChild?.className).toContain('bg-emerald-700')
  })

  it('Stäng döljer banderollen och minns det', async () => {
    const b = banner({ stil: 'Nyhet', rubrik: 'Nytt' })
    visa(b)
    await userEvent.click(screen.getByRole('button', { name: 'Stäng' }))
    expect(screen.queryByText('Filtrera på plats')).toBeNull()
    expect(localStorage.getItem('si_maintenance_dismissed_b1')).toBe(bannerAvtryck(b))
  })

  it('en stängd Kommande-banderoll visas igen när den byts till Nyhet', () => {
    const kommande = banner({ stil: 'Kommande', rubrik: 'Kommer 15 oktober' })
    localStorage.setItem('si_maintenance_dismissed_b1', bannerAvtryck(kommande))
    visa(banner({ stil: 'Nyhet', rubrik: 'Nytt på Samhällsinformation' }))
    expect(screen.getByText('Nytt på Samhällsinformation')).toBeInTheDocument()
  })

  it('en driftbanderoll som stängdes innan stilfältet fanns förblir stängd', () => {
    const b = banner({ message: 'Planerat underhåll' })
    localStorage.setItem('si_maintenance_dismissed_b1', `${b.message}|${b.startUtc}|${b.endUtc}`)
    visa(b)
    expect(screen.queryByText('Planerat underhåll')).toBeNull()
  })
})

describe('bannerAvtryck', () => {
  it('en tillagd Läs mer-länk ger ett nytt avtryck, så banderollen visas igen', () => {
    const utan = banner({ stil: 'Kommande', rubrik: 'Kommer 15 oktober' })
    expect(bannerAvtryck({ ...utan, lankUrl: '/uppdateringar' })).not.toBe(bannerAvtryck(utan))
  })
})

describe('arInternSokvag', () => {
  it.each(['/uppdateringar', '/uppdateringar#v0.8:nyheter', '/?tid=12:00'])('godkänner %s', url => {
    expect(arInternSokvag(url)).toBe(true)
  })
  it.each(['https://evil.se', '//evil.se', '/\\evil.se', 'javascript:alert(1)', 'uppdateringar', '/\t/evil.se', '/\n/evil.se', '/ /evil.se'])('nekar %j', url => {
    expect(arInternSokvag(url)).toBe(false)
  })
})
