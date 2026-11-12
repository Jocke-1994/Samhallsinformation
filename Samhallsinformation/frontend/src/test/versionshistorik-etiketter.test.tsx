import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Uppdatering } from '../api/uppdateringar'

// Profil → Uppdateringar, Versionshistorik: de hopfällda raderna visade
// radens PLATS som etikett ("Allmänt Allmänt") i stället för vad det är.
// Nu en etikett per TYP. Upptäckt 2026-11-02 i bilderna inför att sidan slås på.

function release(
  id: string,
  titel: string,
  datum: string,
  punkter: Uppdatering['punkter'],
): Uppdatering {
  return {
    id,
    titel,
    datum,
    publicerad: true,
    punkter,
    schemalagdPubliceringUtc: null,
    schemalagdaFlaggor: [],
    skickaPush: false,
    pushVersion: null,
    pushMeddelande: null,
    visaBanderoll: false,
    annonseringUtc: null,
    annonseradUtc: null,
    pushSkickaVid: 'Lansering',
    createdAt: datum,
    visaVadArNytt: false,
  }
}

const SENASTE = release('r2', 'Senaste', '2026-09-15T00:00:00Z', [
  { id: 'a', typ: 'ny-funktion', plats: 'Allmänt', text: 'x', synlighet: 'alla' },
])
const SMHI = release('r1', 'SMHI är tillagd som källa', '2026-06-25T00:00:00Z', [
  { id: 'b', typ: 'ny-funktion', plats: 'Allmänt', text: 'SMHI har lagts till', synlighet: 'alla' },
  { id: 'c', typ: 'buggfix', plats: 'Allmänt', text: 'Stabilitet', synlighet: 'alla' },
  { id: 'd', typ: 'buggfix', plats: 'Allmänt', text: 'Fler buggfixar', synlighet: 'alla' },
])

vi.mock('../api/uppdateringar', async () => {
  const faktisk =
    await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return { ...faktisk, fetchUppdateringar: () => Promise.resolve([SENASTE, SMHI]) }
})
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true }) }))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => ({
    uppdateringar_senaste: true,
    uppdateringar_pagang: false,
    uppdateringar_kanda_problem: false,
    uppdateringar_historik: true,
  }),
}))

const { default: ProfilUppdateringar } = await import('../components/Profile/Uppdateringar')

describe('Versionshistorik — hopfällda rader', () => {
  it('visar en etikett per typ, inte radens plats', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ProfilUppdateringar />
      </QueryClientProvider>,
    )

    const rad = (await screen.findByText('SMHI är tillagd som källa')).closest('button')!
    expect(within(rad).getByText('Nytt')).toBeInTheDocument()
    expect(within(rad).getAllByText('Fixat')).toHaveLength(1) // två buggfixar → en etikett
    expect(within(rad).queryByText('Allmänt')).not.toBeInTheDocument()
  })
})
