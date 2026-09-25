import { describe, expect, it } from 'vitest'
// ?raw ger filens råtext utan att Vite behandlar den som HTML-ingång — då
// slipper vi Node-typer (fs/path) i app-tsconfig.
import indexHtml from '../../index.html?raw'

// Skript-vakt (villkor 1 i alt C-bevakningen, FIXPLAN "Parkerade alternativ P1").
//
// Refresh-token ligger i localStorage, så varje extern skriptkälla på sidan
// kan i värsta fall läsa den. Alt C (refresh-token i httpOnly-cookie) ska tas
// upp igen när fler externa skript än chat.js läggs in — det här testet gör
// att en sådan ändring inte kan slinka igenom obemärkt i en PR.
//
// Lägg BARA till en ny rad här efter att alt C-bevakningen har stämts av.
// Nyckel = origin (schema + värd), värde = motivering.
const TILLATNA_EXTERNA_SKRIPTKALLOR: Record<string, string> = {
  'https://kundtjanstbot-production.up.railway.app':
    'Kundtjänstbotens chat.js (egen tjänst på Railway)',
  'https://www.googletagmanager.com':
    'Google Analytics (gtag.js, Consent Mode v2 — analytics nekad tills användaren accepterar)',
}

// Bara för att kunna avgöra "extern": relativa URL:er (t.ex. /src/main.tsx)
// löses mot den här och räknas som egen domän.
const EGEN_ORIGIN = 'https://samhallsinformation.se'

const VARNING =
  'Ny extern skriptkälla — stäm av alt C-bevakningen (refresh-token i httpOnly-cookie) innan den läggs till.'

// Alla skript-URL:er i dokumentet: script[src], modulepreload och preload as=script.
function skriptUrler(html: string): string[] {
  const dok = new DOMParser().parseFromString(html, 'text/html')
  return [
    ...dok.querySelectorAll('script[src]'),
    ...dok.querySelectorAll('link[rel~="modulepreload"][href], link[rel~="preload"][as="script"][href]'),
  ].map(el => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
}

// Externa skript-URL:er vars origin inte står på tillåtelselistan.
function hittaOtillatnaSkriptkallor(html: string, tillatna: string[]): string[] {
  return skriptUrler(html).filter(url => {
    let origin: string
    try {
      origin = new URL(url, EGEN_ORIGIN).origin
    } catch {
      return true // ogiltig URL: hellre falskt larm än en missad källa
    }
    return origin !== EGEN_ORIGIN && !tillatna.includes(origin)
  })
}

describe('index.html: externa skriptkällor', () => {
  it('laddar bara skript från tillåtelselistan', () => {
    const otillatna = hittaOtillatnaSkriptkallor(indexHtml, Object.keys(TILLATNA_EXTERNA_SKRIPTKALLOR))

    expect(
      otillatna,
      `${VARNING}\nOtillåtna källor: ${otillatna.join(', ')}`,
    ).toEqual([])
  })

  it('tillåtelselistan innehåller inga källor som inte längre används (håll den ärlig)', () => {
    const anvanda = skriptUrler(indexHtml).map(url => new URL(url, EGEN_ORIGIN).origin)

    for (const origin of Object.keys(TILLATNA_EXTERNA_SKRIPTKALLOR)) {
      expect(anvanda, `${origin} står på listan men laddas inte i index.html`).toContain(origin)
    }
  })
})

// Bevisar att vakten faktiskt slår till (annars vore ett grönt test ointressant).
describe('skriptvaktens egen logik', () => {
  const tillatna = ['https://tillaten.example']

  it('fångar en ny extern <script src>', () => {
    const html = '<head><script src="https://ny-kalla.example/x.js"></script></head>'
    expect(hittaOtillatnaSkriptkallor(html, tillatna)).toEqual(['https://ny-kalla.example/x.js'])
  })

  it('fångar en extern modulepreload och preload as=script', () => {
    const html = `<head>
      <link rel="modulepreload" href="https://ny-kalla.example/a.js">
      <link rel="preload" as="script" href="https://annan.example/b.js">
    </head>`
    expect(hittaOtillatnaSkriptkallor(html, tillatna)).toHaveLength(2)
  })

  it('fångar protokollrelativa URL:er (//domän/...)', () => {
    const html = '<script src="//ny-kalla.example/x.js"></script>'
    expect(hittaOtillatnaSkriptkallor(html, tillatna)).toHaveLength(1)
  })

  it('släpper igenom egna relativa skript, tillåtna domäner och inline-skript', () => {
    const html = `<head>
      <script>var x = 1</script>
      <script type="module" src="/src/main.tsx"></script>
      <script src="https://tillaten.example/chat.js"></script>
      <link rel="stylesheet" href="https://fonts.example/css">
    </head>`
    expect(hittaOtillatnaSkriptkallor(html, tillatna)).toEqual([])
  })

  it('varningstexten är den avtalade', () => {
    expect(VARNING).toBe(
      'Ny extern skriptkälla — stäm av alt C-bevakningen (refresh-token i httpOnly-cookie) innan den läggs till.',
    )
  })
})
