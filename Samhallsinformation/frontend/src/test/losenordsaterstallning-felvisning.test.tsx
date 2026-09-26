import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import ResetPasswordPage from '../pages/ResetPasswordPage'

// V3-9: lösenordsåterställningen ska aldrig visa webbläsarens råa nätverksfel
// ("Failed to fetch"), och serverns egna svenska text ska fortfarande visas.
function rendera() {
  return render(
    <MemoryRouter initialEntries={['/aterstall?token=abc']}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

async function skickaFormular() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('Minst 8 tecken'), 'nytt-losenord')
  await user.type(screen.getByPlaceholderText('••••••••'), 'nytt-losenord')
  await user.click(screen.getByRole('button', { name: 'Spara nytt lösenord' }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ResetPasswordPage', () => {
  it('nätverksfel: svensk text i stället för "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    rendera()

    await skickaFormular()

    expect(await screen.findByText('Något gick fel, försök igen')).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spara nytt lösenord' })).toBeEnabled()
  })

  it('serverfel med egen svensk text: texten visas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Länken har gått ut.' }),
    }))
    rendera()

    await skickaFormular()

    expect(await screen.findByText('Länken har gått ut.')).toBeInTheDocument()
  })
})
