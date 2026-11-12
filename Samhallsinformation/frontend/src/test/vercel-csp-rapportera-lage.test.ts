import { describe, expect, it } from 'vitest'
// ?raw ger filens råtext — då slipper vi resolveJsonModule/Node-typer i app-tsconfig.
import vercelRaw from '../../vercel.json?raw'
import indexHtml from '../../index.html?raw'
import swJs from '../../public/sw.js?raw'

// CSP i rapportera-läge (V3-22, beslut D4 alt B i FIXPLAN).
//
// Policyn ligger som en Vercel-header (vercel.json) och är ENBART report-only: webbläsaren rapporterar
// överträdelser till backend (POST /api/csp-report) men blockerar aldrig något. Syftet är en tidig varning
// om oväntade skriptkällor (villkor 2 i alt C-bevakningen). Det här testet ser till att
//  - policyn förblir report-only (ingen enforcing header smyger in),
//  - skriptkällorna i policyn och i skript-vakten (index-html-skriptvakt.test.ts) inte glider isär,
//  - rapporteringen pekar på rätt endpoint.

const BACKEND = 'https://samhallsinformation-production.up.railway.app'
const REPORT_URL = `${BACKEND}/api/csp-report`
// Google Identity Services laddas dynamiskt av @react-oauth/google (inte i index.html) —
// den enda tillåtna skriptkällan som skript-vakten inte ser.
const DYNAMISKA_SKRIPTKALLOR = ['https://accounts.google.com']

interface HeaderRad {
  key: string
  value: string
}
interface VercelConfig {
  headers?: { source: string; headers: HeaderRad[] }[]
}

const config = JSON.parse(vercelRaw) as VercelConfig
const allaHeaders: HeaderRad[] = (config.headers ?? []).flatMap((h) => h.headers)

function header(namn: string): string | undefined {
  return allaHeaders.find((h) => h.key.toLowerCase() === namn.toLowerCase())?.value
}

// "script-src 'self' https://a.example" -> { 'script-src': ["'self'", 'https://a.example'] }
function parsaPolicy(policy: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const del of policy
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [namn, ...kallor] = del.split(/\s+/)
    result[namn] = kallor
  }
  return result
}

function origins(kallor: string[]): string[] {
  return kallor
    .filter((k) => k.startsWith('https://'))
    .map((k) => new URL(k.replace('*.', 'x.')).origin)
}

// Samma tolkning som skript-vakten: script[src] plus modulepreload/preload as=script,
// externa (annan origin än sajten) origins.
function externaSkriptOrigins(html: string): string[] {
  const dok = new DOMParser().parseFromString(html, 'text/html')
  const urls = [
    ...dok.querySelectorAll('script[src]'),
    ...dok.querySelectorAll(
      'link[rel~="modulepreload"][href], link[rel~="preload"][as="script"][href]',
    ),
  ].map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
  const egen = 'https://samhallsinformation.se'
  return [...new Set(urls.map((u) => new URL(u, egen).origin).filter((o) => o !== egen))].sort()
}

const policyText = header('Content-Security-Policy-Report-Only') ?? ''
const policy = parsaPolicy(policyText)

describe('vercel.json: CSP i rapportera-läge', () => {
  it('är giltig JSON med en headers-sektion som gäller alla routes', () => {
    expect(Array.isArray(config.headers)).toBe(true)
    expect(config.headers!.some((h) => h.source === '/(.*)')).toBe(true)
  })

  it('har Content-Security-Policy-Report-Only', () => {
    expect(policyText).not.toBe('')
    expect(policy['default-src']).toEqual(["'self'"])
  })

  it('har INGEN enforcing Content-Security-Policy (bara report-only, får inte kunna blockera något)', () => {
    const enforcing = allaHeaders.filter((h) => h.key.toLowerCase() === 'content-security-policy')
    expect(enforcing).toEqual([])
    // ...och inte heller via ett meta-tag i index.html
    expect(indexHtml.toLowerCase()).not.toContain('http-equiv="content-security-policy"')
  })

  it('tillåter exakt de externa skriptkällorna som skript-vakten godkänner (plus Google Identity)', () => {
    const iPolicyn = [...new Set(origins(policy['script-src'] ?? []))].sort()
    const forvantat = [
      ...new Set([...externaSkriptOrigins(indexHtml), ...DYNAMISKA_SKRIPTKALLOR]),
    ].sort()

    expect(
      iPolicyn,
      'script-src i vercel.json och tillåtelselistan i index-html-skriptvakt.test.ts har glidit isär',
    ).toEqual(forvantat)
  })

  it('script-src har ingen bred källa (ingen jokertecken, ingen bar https:, ingen unsafe-eval)', () => {
    const script = policy['script-src'] ?? []
    expect(script).not.toContain('*')
    expect(script).not.toContain('https:')
    expect(script).not.toContain('http:')
    expect(script).not.toContain("'unsafe-eval'")
    // Inline-skripten i index.html (tema, gtag) kräver unsafe-inline i report-only.
    expect(script).toContain("'unsafe-inline'")
    expect(script).toContain("'self'")
  })

  it('täcker de källtyper sidan faktiskt använder', () => {
    expect(policy['connect-src']).toContain(BACKEND) // API + service workern
    expect(policy['connect-src']).toContain('https://*.google-analytics.com')
    expect(policy['connect-src']).toContain('https://accounts.google.com/gsi/')
    expect(policy['frame-src']).toContain('https://accounts.google.com/gsi/')
    expect(policy['img-src']).toContain('data:')
    expect(policy['worker-src']).toEqual(["'self'"])
    expect(policy['manifest-src']).toEqual(["'self'"])
    expect(policy['object-src']).toEqual(["'none'"])
    expect(policy['base-uri']).toEqual(["'self'"])
  })

  it('backend-API:t som service workern anropar (public/sw.js) står i connect-src', () => {
    const swApi = /API_BASE\s*=\s*'([^']+)'/.exec(swJs)?.[1]
    expect(swApi).toBeDefined()
    expect(policy['connect-src']).toContain(swApi)
  })

  it('rapporterar till backend-endpointen, både report-uri (legacy) och report-to (Reporting API)', () => {
    expect(policy['report-uri']).toEqual([REPORT_URL])

    const grupp = policy['report-to']?.[0]
    expect(grupp).toBeTruthy()
    const endpoints = header('Reporting-Endpoints') ?? ''
    expect(endpoints).toBe(`${grupp}="${REPORT_URL}"`)
  })
})
