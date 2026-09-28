import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// E7#10 (V4-4):
// (a) upptagen e-post upptäcktes tidigare först i sista steget (register()
//     anropas där) — ingen billig "finns adressen redan"-endpoint finns i
//     backend (bekräftat, se PR-texten), så fixen är en tidig FORMATKONTROLL
//     på blur i stället; upptagen-kontrollen ligger kvar sist.
// (b) en Google-inloggd användare (kontoSkapat=true redan i steg 1) som
//     klickade "Tillbaka" från Källor-steget tvingades fylla i ett påhittat
//     lösenord (native required-fält) för att komma vidare igen.

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: false, register: vi.fn() }),
}))
vi.mock('../api/sources', () => ({ fetchSources: async () => [] }))
vi.mock('../api/userSources', () => ({ saveUserSources: vi.fn() }))

const googleMock = vi.hoisted(() => ({ onSuccess: null as null | ((p: { name: string; email: string }, isNewUser: boolean) => void) }))
vi.mock('../components/Auth/GoogleSignInButton', () => ({
  default: ({ onSuccess }: { onSuccess: (p: { name: string; email: string }, isNewUser: boolean) => void }) => {
    googleMock.onSuccess = onSuccess
    return <button type="button" onClick={() => onSuccess({ name: 'Anna Google', email: 'anna@gmail.com' }, true)}>Fortsätt med Google</button>
  },
}))

function nyKlient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

async function rendera() {
  const { default: OnboardingPage } = await import('../pages/OnboardingPage')
  return render(
    <QueryClientProvider client={nyKlient()}>
      <MemoryRouter initialEntries={['/register']}>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Onboarding: tidig e-postformatkontroll', () => {
  it('visar ett fel direkt vid blur på ett ogiltigt e-postformat, innan Nästa klickas', async () => {
    await rendera()
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText('din@epost.se'), 'inte-en-epost')
    await user.tab() // blur

    expect(await screen.findByText('Ange en giltig e-postadress')).toBeInTheDocument()
  })

  it('felet försvinner igen när adressen rättas', async () => {
    await rendera()
    const user = userEvent.setup()
    const epostFalt = screen.getByPlaceholderText('din@epost.se')

    await user.type(epostFalt, 'fel')
    await user.tab()
    expect(await screen.findByText('Ange en giltig e-postadress')).toBeInTheDocument()

    await user.clear(epostFalt)
    await user.type(epostFalt, 'anna@example.com')
    await user.tab()
    expect(screen.queryByText('Ange en giltig e-postadress')).not.toBeInTheDocument()
  })
})

describe('Onboarding: Google-vägen kräver inte lösenord vid tillbaka-framåt', () => {
  it('"Tillbaka" från Källor-steget visar inga lösenordsfält, och "Nästa" fungerar utan dem', async () => {
    await rendera()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Fortsätt med Google' }))

    // Nu på Källor-steget (kontoSkapat=true).
    expect(await screen.findByText('Vilka källor vill du följa?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tillbaka' }))

    // Tillbaka på Konto-steget — inga lösenordsfält, ingen Google-knapp igen.
    expect(await screen.findByText(/anna@gmail\.com/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Minst 8 tecken')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fortsätt med Google' })).not.toBeInTheDocument()

    // "Nästa" ska gå igenom utan att kräva ett lösenord.
    await user.click(screen.getByRole('button', { name: 'Nästa' }))
    expect(await screen.findByText('Vilka källor vill du följa?')).toBeInTheDocument()
    expect(screen.queryByText('Lösenordet måste vara minst 8 tecken')).not.toBeInTheDocument()
  })
})
