import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// V4-3 (E6#18): ett tömt datum-/tidsfält fick tidigare `new Date('').toISOString()`
// att kasta ett RangeError i klickhanteraren — knappen "dog" utan att visa något
// fel. `kanSpara` ska nu räkna ett tomt/ogiltigt datum som "kan inte sparas" och
// knappen ska förbli disabled i stället för att kasta.

vi.mock('../api/uppdateringar', async () => {
  const faktisk =
    await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return {
    ...faktisk,
    fetchAdminUppdateringar: vi.fn().mockResolvedValue([]),
    createUppdatering: vi.fn(),
    updateUppdatering: vi.fn(),
    deleteUppdatering: vi.fn(),
  }
})
vi.mock('../api/featureFlags', () => ({ fetchAdminFeatureFlags: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/faq', () => ({ fetchAdminFaq: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))

const api = await import('../api/uppdateringar')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

function rendera() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AdminUppdateringar />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.createUppdatering).mockReset()
  vi.mocked(api.updateUppdatering).mockReset()
})

describe('AdminUppdateringar — tömt datumfält', () => {
  it('ett tömt Datum-fält gör Publicera/Spara-knapparna disabled i stället för att kasta vid klick', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))

    await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Titel')
    await userEvent.type(
      screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'),
      'En rad text',
    )

    const datumFält = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(datumFält).toBeInTheDocument()
    fireEvent.change(datumFält, { target: { value: '' } })

    const publiceraKnapp = screen.getByRole('button', { name: 'Publicera' })
    expect(publiceraKnapp).toBeDisabled()

    // Klick på en disabled-knapp anropar aldrig onClick i webbläsaren, men vi
    // klickar ändå explicit för att bevisa att INGET kastas och inget anrop görs.
    expect(() => fireEvent.click(publiceraKnapp)).not.toThrow()
    expect(api.createUppdatering).not.toHaveBeenCalled()

    // Ett giltigt datum igen gör knappen klickbar utan krasch.
    fireEvent.change(datumFält, { target: { value: '2026-10-01' } })
    expect(screen.getByRole('button', { name: 'Publicera' })).not.toBeDisabled()
  })

  it('ett tomt schemalagt datum/tid håller Schemalägg-knappen disabled', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))

    await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Titel')
    await userEvent.type(
      screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'),
      'En rad text',
    )
    await userEvent.click(screen.getByText('Schemalägg lansering'))

    // datetime-local-fältet är tomt som standard.
    const knapp = screen.getByRole('button', { name: /Schemalägg/ })
    expect(knapp).toBeDisabled()
    expect(() => fireEvent.click(knapp)).not.toThrow()
    expect(api.createUppdatering).not.toHaveBeenCalled()
  })
})
