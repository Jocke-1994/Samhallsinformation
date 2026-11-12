import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LösenordByte from '../components/Profile/Konto/LösenordByte'
import { changePassword } from '../api/auth'

vi.mock('../api/auth', () => ({ changePassword: vi.fn() }))
const changePasswordMock = vi.mocked(changePassword)

function renderaKort(harLosenord = true) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LösenordByte harLosenord={harLosenord} />
    </QueryClientProvider>,
  )
}

async function fyllIFormularet(
  gammalt = 'gammalt-losen',
  nytt = 'helt-nytt-losen',
  bekrafta = nytt,
) {
  await userEvent.type(screen.getByLabelText('Nuvarande lösenord'), gammalt)
  await userEvent.type(screen.getByLabelText('Nytt lösenord'), nytt)
  await userEvent.type(screen.getByLabelText('Bekräfta nytt lösenord'), bekrafta)
}

const knapp = () => screen.getByRole('button', { name: /byt lösenord|byter lösenord/i })

describe('LösenordByte (V1-1)', () => {
  beforeEach(() => {
    changePasswordMock.mockReset()
  })

  it('visar bekräftelse och nollställer fälten först när servern svarat OK', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    renderaKort()

    await fyllIFormularet()
    await userEvent.click(knapp())

    expect(await screen.findByText(/Lösenordet har ändrats/)).toBeInTheDocument()
    expect(changePasswordMock).toHaveBeenCalledExactlyOnceWith('gammalt-losen', 'helt-nytt-losen')
    expect(screen.getByLabelText('Nuvarande lösenord')).toHaveValue('')
    expect(screen.getByLabelText('Nytt lösenord')).toHaveValue('')
    expect(screen.getByLabelText('Bekräfta nytt lösenord')).toHaveValue('')
  })

  it('visar serverfelet, ingen bekräftelse, och behåller det användaren skrivit', async () => {
    changePasswordMock.mockRejectedValue(new Error('Nuvarande lösenord stämmer inte'))
    renderaKort()

    await fyllIFormularet()
    await userEvent.click(knapp())

    expect(await screen.findByText('Nuvarande lösenord stämmer inte')).toBeInTheDocument()
    expect(screen.queryByText(/Lösenordet har ändrats/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nytt lösenord')).toHaveValue('helt-nytt-losen')
    expect(knapp()).toBeEnabled()
  })

  it('anropar inte servern när det lokala valideringen fallerar', async () => {
    renderaKort()

    await fyllIFormularet('gammalt-losen', 'kort', 'kort')
    await userEvent.click(knapp())
    expect(await screen.findByText('Nytt lösenord måste vara minst 8 tecken.')).toBeInTheDocument()

    changePasswordMock.mockClear()
    await userEvent.clear(screen.getByLabelText('Nytt lösenord'))
    await userEvent.type(screen.getByLabelText('Nytt lösenord'), 'helt-nytt-losen')
    await userEvent.click(knapp())
    expect(await screen.findByText('Lösenorden matchar inte.')).toBeInTheDocument()

    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('låser knappen under pågående anrop så det inte går att skicka två gånger', async () => {
    let avsluta!: () => void
    changePasswordMock.mockReturnValue(
      new Promise<void>((resolve) => {
        avsluta = resolve
      }),
    )
    renderaKort()

    await fyllIFormularet()
    await userEvent.click(knapp())

    await waitFor(() => expect(knapp()).toBeDisabled())
    await userEvent.click(knapp())
    expect(changePasswordMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Lösenordet har ändrats/)).not.toBeInTheDocument()

    avsluta()
    expect(await screen.findByText(/Lösenordet har ändrats/)).toBeInTheDocument()
    expect(knapp()).toBeEnabled()
  })

  it('döljer formuläret och förklarar för konton utan lösenord (Google)', () => {
    renderaKort(false)

    expect(screen.queryByLabelText('Nuvarande lösenord')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /byt lösenord/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Du loggar in med Google/)).toBeInTheDocument()
  })
})
