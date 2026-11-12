import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/common/ErrorBoundary'

// V3-7 (E7#8): utan ErrorBoundary ger ett enda kastande renderfel vit skärm.
// Fallbacken får inte bero på router/kontexter — därför renderas den här helt
// utan providers.

let ska_kasta = true

function Bomb() {
  if (ska_kasta) throw new Error('bang')
  return <p>allt fungerar</p>
}

describe('ErrorBoundary', () => {
  let felLogg: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    ska_kasta = true
    // React och boundaryn loggar det förväntade felet — tysta det i testerna.
    felLogg = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => felLogg.mockRestore())

  it('visar en svensk felvy i stället för vit skärm när ett barn kastar (utan providers)', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Något gick fel')
    expect(screen.getByRole('button', { name: 'Ladda om sidan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Till startsidan' })).toHaveAttribute('href', '/')
    expect(screen.queryByText('allt fungerar')).not.toBeInTheDocument()
  })

  it('loggar felet till console.error', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(felLogg).toHaveBeenCalledWith(
      'Renderfel fångades av ErrorBoundary',
      expect.objectContaining({ message: 'bang' }),
      expect.anything(),
    )
  })

  it('renderar barnen orörda när inget kastar', () => {
    ska_kasta = false
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('allt fungerar')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('återställs när resetKeys ändras (t.ex. vid route-byte)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    ska_kasta = false
    rerender(
      <ErrorBoundary resetKeys={['b']}>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('allt fungerar')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('återställs inte när resetKeys är oförändrade', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Bomb />
      </ErrorBoundary>,
    )

    ska_kasta = false
    rerender(
      <ErrorBoundary resetKeys={['a']}>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
