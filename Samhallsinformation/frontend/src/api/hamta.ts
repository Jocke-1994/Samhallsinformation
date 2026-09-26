// Gemensam grund för alla nätverksanrop i src/api/ (E5#14):
//  - en standardtimeout så ett hängande anrop (Railway-kallstart, tappad
//    anslutning) blir ett tydligt fel i stället för evig laddning, och
//  - felkroppen bevaras: serverns egen svenska text (JSON { error } eller
//    ren text) följer med i det kastade felet.
import { TIDSGRANS_TEXT } from '../lib/felmeddelande'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const STANDARD_TIMEOUT_MS = 30_000
// För kända långa anrop (resync av en källa, testkörningar mot externa flöden,
// GDPR-export, utskick till alla enheter) så legitima anrop inte bryts.
export const LANG_TIMEOUT_MS = 120_000

// Kastas när ett anrop inte svarat inom sin tidsgräns. `name` är 'TimeoutError'
// (samma som webbläsarens egen AbortSignal.timeout) så visaFel känner igen det.
export class TimeoutFel extends Error {
  constructor() {
    super(TIDSGRANS_TEXT)
    this.name = 'TimeoutError'
  }
}

// Ett svar med felstatus. `serverText` är serverns egen text när den fanns
// (annars null och meddelandet är den tekniska formen "namn: status").
export class ApiFel extends Error {
  readonly status: number
  readonly serverText: string | null
  constructor(meddelande: string, status: number, serverText: string | null) {
    super(meddelande)
    this.name = 'ApiFel'
    this.status = status
    this.serverText = serverText
  }
}

export type FetchInit = RequestInit & {
  // Millisekunder. Utelämnad = standardtimeout, 0 = ingen timeout.
  timeoutMs?: number
}

// fetch med tidsgräns. Räknar hela anropet, inklusive inläsning av svarskroppen
// (timern lämnas därför igång när svaret kommit; efter en färdiginläst kropp
// är ett avbrott utan verkan).
// En egen AbortController + setTimeout (i stället för AbortSignal.timeout) så
// att tidsgränsen även går att testa med fake timers. En medskickad `signal`
// (t.ex. react-querys) avbryter fortfarande anropet.
export async function fetchMedTimeout(url: string, init: FetchInit = {}): Promise<Response> {
  const { timeoutMs = STANDARD_TIMEOUT_MS, signal: yttreSignal, ...ovrigt } = init
  if (!(timeoutMs > 0) || !Number.isFinite(timeoutMs)) {
    return fetch(url, { ...ovrigt, signal: yttreSignal })
  }

  const kontroll = new AbortController()
  let tidsUt = false
  const timer = setTimeout(() => {
    tidsUt = true
    kontroll.abort(new TimeoutFel())
  }, timeoutMs)

  const vidYttreAvbrott = () => kontroll.abort(yttreSignal?.reason)
  if (yttreSignal) {
    if (yttreSignal.aborted) vidYttreAvbrott()
    else yttreSignal.addEventListener('abort', vidYttreAvbrott, { once: true })
  }

  try {
    return await fetch(url, { ...ovrigt, signal: kontroll.signal })
  } catch (fel) {
    clearTimeout(timer)
    yttreSignal?.removeEventListener('abort', vidYttreAvbrott)
    // Äldre webbläsare avvisar med ett generellt AbortError i stället för
    // abort-anledningen — tidsgränsen känns ändå igen på flaggan.
    if (tidsUt) throw new TimeoutFel()
    throw fel
  }
}

// Publika anrop utan auktorisering (adminFetch gör de auktoriserade).
export function publikFetch(path: string, init?: FetchInit): Promise<Response> {
  return fetchMedTimeout(`${API_BASE}${path}`, init)
}

const MAX_TEXTLANGD = 300

async function lasServerText(res: Response): Promise<string | null> {
  let rå: string
  try {
    rå = (await res.text()).trim()
  } catch {
    return null
  }
  if (rå === '') return null

  try {
    const json: unknown = JSON.parse(rå)
    const fel = json !== null && typeof json === 'object' ? (json as { error?: unknown }).error : undefined
    return typeof fel === 'string' && fel.trim() !== '' && fel.length <= MAX_TEXTLANGD ? fel.trim() : null
  } catch {
    // Ingen JSON. Ren text är serverns eget klientfel (t.ex. BadRequest("Max 5
    // bevakningar …")) — men aldrig HTML (proxy-/felsidor) eller text från 5xx,
    // som är tekniskt och inte avsett för användaren.
    if (res.status >= 500 || rå.startsWith('<') || rå.length > MAX_TEXTLANGD) return null
    return rå
  }
}

const TOO_MANY_REQUESTS_TEXT = 'För många försök på kort tid. Vänta en stund och försök igen.'

// Bygger felet för ett icke-ok-svar. Används av alla API-funktioner:
//   if (!res.ok) throw await felFranSvar(res, 'fetchSources')
// Serverns text (JSON { error } eller ren text) behålls som meddelande; saknas
// den blir meddelandet "namn: status" som förut (visaFel byter sådana mot en
// reservtext skriven för just handlingen).
export async function felFranSvar(res: Response, namn: string): Promise<ApiFel> {
  const serverText = await lasServerText(res)
  const text = serverText ?? (res.status === 429 ? TOO_MANY_REQUESTS_TEXT : null)
  return new ApiFel(text ?? `${namn}: ${res.status}`, res.status, serverText)
}
