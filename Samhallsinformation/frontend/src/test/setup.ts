import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Isolera varje test: rensa webbläsarlagring och återställ riktiga timers så
// att ett test som använt fake timers eller skrivit till localStorage inte
// läcker in i nästa. RTL:s cleanup() körs automatiskt tack vare globals: true.
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useRealTimers()
})
