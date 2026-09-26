import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { registerAuthBridge } from '../api/authBridge'
import { rensaAnvandardata } from '../lib/queryRensning'
import { avregistreraPushEnhet } from '../lib/pushAvregistrering'
import { valjAktivVy } from '../lib/aktivVy'
import {
  MAX_REFRESH_FORSOK,
  beraknaRefreshFordrojning,
  beraknaRetryFordrojning,
  beslutaAtgardVidFel,
} from '../lib/refreshPolicy'

export type SystemRoll = 'Användare' | 'Support' | 'Admin'

interface AuthContextType {
  isLoggedIn: boolean
  // Aktuell access-token. Konsumenter som hämtar användarspecifik data
  // använder den bara som "har sessionen förnyats/bytts?"-signal.
  accessToken: string | null
  roll: SystemRoll
  aktivVy: SystemRoll
  email: string | null
  name: string | null
  emailVerified: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, acceptedTerms: boolean) => Promise<void>
  // Returnerar om Google-inloggningen skapade ett NYTT konto eller loggade in
  // på ett redan befintligt — OnboardingPage använder det för att hoppa
  // förbi Källor-guiden helt vid en inloggning på ett befintligt konto.
  loginWithGoogle: (idToken: string, acceptedTerms: boolean) => Promise<boolean>
  logout: () => void
  byttVy: (vy: SystemRoll) => void
  refreshSession: () => Promise<void>
  setAccessToken: (token: string) => void
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// localStorage-nycklar som bär sessionen och som andra flikar kan ändra.
const SESSIONSNYCKLAR = ['si_token', 'si_refresh_token', 'si_logged_in']

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function parseRole(token: string): SystemRoll {
  const role = decodePayload(token)?.['role']
  if (role === 'Admin') return 'Admin'
  if (role === 'Support') return 'Support'
  return 'Användare'
}

function decodeExp(token: string): number | null {
  const exp = decodePayload(token)?.['exp']
  return typeof exp === 'number' ? exp * 1000 : null
}

function decodeIat(token: string): number | null {
  const iat = decodePayload(token)?.['iat']
  return typeof iat === 'number' ? iat * 1000 : null
}

function parseEmail(token: string): string | null {
  const email = decodePayload(token)?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
  return typeof email === 'string' ? email : null
}

function parseName(token: string): string | null {
  const name = decodePayload(token)?.['name']
  return typeof name === 'string' ? name : null
}

function parseEmailVerified(token: string): boolean {
  return decodePayload(token)?.['emailVerified'] === 'true'
}

async function authRequest(url: string, body: object): Promise<TokenPair & { role: string; name: string; isNewUser?: boolean }> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Något gick fel')
  }
  return res.json()
}

interface RefreshSvar {
  data: TokenPair | null
  status: number | null
  retryAfter: string | null
}

// Ett anrop mot /refresh. status === null = fetch kastade (nätverksfel).
async function hamtaNyaTokens(refreshToken: string): Promise<RefreshSvar> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })
    if (res.ok) return { data: await res.json(), status: res.status, retryAfter: null }
    return { data: null, status: res.status, retryAfter: res.headers.get('Retry-After') }
  } catch {
    return { data: null, status: null, retryAfter: null }
  }
}

// Refresh roterar refresh-token (den gamla spärras), så bara EN flik/PWA-instans
// får refresha åt gången. Web Locks delas mellan alla flikar av samma origin;
// finns de inte (äldre webbläsare) körs refreshen utan lås — då tar
// storage-synken och 401-adoptionen hand om det som ändå kolliderar.
async function medRefreshLas<T>(fn: () => Promise<T>): Promise<T> {
  const las = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!las || typeof las.request !== 'function') return fn()
  return await las.request('si-refresh', fn)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('si_token'))
  const tokenRef = useRef<string | null>(token)
  const refreshTokenRef = useRef<string | null>(localStorage.getItem('si_refresh_token'))

  // Enda vägen att byta access-token: byter token utan utloggning däremellan
  // (annan användare loggar in direkt) rensas den förra användarens cache.
  const sattToken = useCallback((ny: string | null) => {
    const forra = tokenRef.current
    if (forra && ny && parseEmail(forra) !== parseEmail(ny)) rensaAnvandardata(queryClient)
    tokenRef.current = ny
    setToken(ny)
  }, [queryClient])

  const isLoggedIn    = token !== null
  const roll          = token ? parseRole(token) : 'Användare'
  const email         = token ? parseEmail(token) : null
  const name          = token ? parseName(token) : null
  const emailVerified = token ? parseEmailVerified(token) : false

  const [aktivVy, setAktivVy] = useState<SystemRoll>(
    () => valjAktivVy(localStorage.getItem('si_aktiv_vy'), roll)
  )

  // Väntande omförsök efter ett tillfälligt refresh-fel, och pågående anrop
  // (så att timer och manuellt refreshSession() inte roterar token parallellt).
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshPagaendeRef = useRef<Promise<void> | null>(null)
  // När access-token senast erhölls från servern (null = inläst ur localStorage vid start)
  const tokenErhallenRef = useRef<number | null>(null)
  const forsokRefreshRef = useRef<((forsok: number) => Promise<void>) | null>(null)

  const avbrytRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  useEffect(() => avbrytRetry, [avbrytRetry])

  // Avslutar sessionen i DEN HÄR fliken utan att röra localStorage eller servern.
  // Används direkt när en annan flik redan loggat ut (lagringen är då tom och
  // refresh-token spärrad), annars via clearSession. Rensar även cachen så nästa
  // användare på enheten inte ser den förras data.
  const lokalUtloggning = useCallback(() => {
    avbrytRetry()
    refreshTokenRef.current = null
    tokenRef.current = null
    setToken(null)
    setAktivVy('Användare')
    rensaAnvandardata(queryClient)
  }, [avbrytRetry, queryClient])

  const clearSession = useCallback(() => {
    // Enheten ska inte förbli registrerad för den här användarens notiser.
    // Token fångas HÄR, före rensningen, och skickas in explicit (adminFetch
    // hittar ingen token efteråt). Fire-and-forget och kastar aldrig — se
    // avregistreraPushEnhet. Bara kontrollerad utloggning/sessionsslut kommer
    // hit; tillfälliga refresh-fel (429/5xx/nät) rensar aldrig sessionen.
    void avregistreraPushEnhet(localStorage.getItem('si_token') ?? tokenRef.current)
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_refresh_token')
    localStorage.removeItem('si_logged_in')
    localStorage.removeItem('si_aktiv_vy')
    lokalUtloggning()
  }, [lokalUtloggning])

  // Tar över sessionen som en annan flik skrivit till den delade localStorage
  // (nya tokens efter refresh/login) — utan nätanrop. Är lagringen tom har en
  // annan flik loggat ut: logga ut lokalt, utan nytt /logout-anrop.
  const adopteraFranLagring = useCallback(() => {
    const lagratToken = localStorage.getItem('si_token')
    const lagratRefresh = localStorage.getItem('si_refresh_token')
    if (!lagratToken && !lagratRefresh) { lokalUtloggning(); return }
    if (lagratToken === tokenRef.current && lagratRefresh === refreshTokenRef.current) return

    avbrytRetry()
    if (lagratRefresh) refreshTokenRef.current = lagratRefresh
    if (lagratToken) {
      tokenErhallenRef.current = Date.now()
      setAktivVy((localStorage.getItem('si_aktiv_vy') as SystemRoll | null) ?? parseRole(lagratToken))
      sattToken(lagratToken)
    }
  }, [avbrytRetry, lokalUtloggning, sattToken])

  useEffect(() => {
    function vidStorage(e: StorageEvent) {
      if (e.storageArea && e.storageArea !== localStorage) return
      // key === null: localStorage.clear() i en annan flik.
      if (e.key !== null && !SESSIONSNYCKLAR.includes(e.key)) return
      adopteraFranLagring()
    }
    window.addEventListener('storage', vidStorage)
    return () => window.removeEventListener('storage', vidStorage)
  }, [adopteraFranLagring])

  const applyTokens = useCallback((data: TokenPair) => {
    localStorage.setItem('si_token', data.accessToken)
    localStorage.setItem('si_refresh_token', data.refreshToken)
    localStorage.setItem('si_logged_in', 'true')
    refreshTokenRef.current = data.refreshToken
    tokenErhallenRef.current = Date.now()
    // Startvyn väljs bara när den saknas eller inte längre gäller för rollen, eller
    // när en ANNAN användare loggar in: en tokenförnyelse (var ~13:e minut) ska
    // inte flytta en admin som valt Support-vyn tillbaka till Admin.
    const newRoll = parseRole(data.accessToken)
    const forraToken = tokenRef.current
    const annanAnvandare = forraToken !== null && parseEmail(forraToken) !== parseEmail(data.accessToken)
    const vy = annanAnvandare ? newRoll : valjAktivVy(localStorage.getItem('si_aktiv_vy'), newRoll)
    localStorage.setItem('si_aktiv_vy', vy)
    setAktivVy(vy)
    sattToken(data.accessToken)
  }, [sattToken])

  // Sessionen avslutas ENDAST när servern avvisar refresh-token (401/403).
  // 429, 5xx och nätverksfel är tillfälliga: refresh-token är fortfarande giltig
  // (30 dagar), så vi behåller sessionen och försöker igen med backoff.
  const forsokRefresh = useCallback((forsok: number): Promise<void> => {
    if (refreshPagaendeRef.current) return refreshPagaendeRef.current
    avbrytRetry()
    const rtVidBegaran = refreshTokenRef.current
    if (!rtVidBegaran) { clearSession(); return Promise.resolve() }

    const anrop = medRefreshLas(async () => {
      // Lagringen läses om EFTER att låset erhållits: har en annan flik hunnit
      // förnya (eller logga ut) medan vi väntade ska vi ta över dess resultat
      // i stället för att skicka vår gamla, nu spärrade refresh-token. Jämförs
      // mot token vi hade när refreshen begärdes, inte mot minnet — storage-
      // synken kan redan ha uppdaterat minnet, och då vore ett nytt anrop
      // bara en onödig rotation.
      if (localStorage.getItem('si_refresh_token') !== rtVidBegaran) {
        adopteraFranLagring()
        return
      }

      let rt = rtVidBegaran
      let harAdopterat = false
      for (;;) {
        const svar = await hamtaNyaTokens(rt)
        // Användaren har loggat ut (eller loggat in på nytt) medan anropet pågick
        if (refreshTokenRef.current !== rt) return
        if (svar.data) { applyTokens(svar.data); return }

        // 401 men lagringen har en ANNAN refresh-token: en annan flik hann före
        // och roterade. Rensa inte den delade lagringen — ta över och försök en gång till.
        if (svar.status === 401 && !harAdopterat) {
          const lagrad = localStorage.getItem('si_refresh_token')
          if (lagrad && lagrad !== rt) {
            harAdopterat = true
            adopteraFranLagring()
            rt = lagrad
            continue
          }
        }

        if (beslutaAtgardVidFel(svar.status) === 'loggaUt') { clearSession(); return }
        if (forsok >= MAX_REFRESH_FORSOK) return
        retryTimerRef.current = setTimeout(
          () => { void forsokRefreshRef.current?.(forsok + 1) },
          beraknaRetryFordrojning(forsok, svar.retryAfter),
        )
        return
      }
    }).finally(() => { refreshPagaendeRef.current = null })

    refreshPagaendeRef.current = anrop
    return anrop
  }, [applyTokens, clearSession, avbrytRetry, adopteraFranLagring])

  // Omförsöket anropar forsokRefresh via en ref (en useCallback får inte referera sig själv).
  useEffect(() => { forsokRefreshRef.current = forsokRefresh }, [forsokRefresh])

  const doRefresh = useCallback(() => forsokRefresh(1), [forsokRefresh])

  // Bron till API-lagret (adminFetch): ett 401 förnyar sessionen via samma
  // single-flight-refresh som timern. Layout-effekt, inte vanlig effekt:
  // barnens (t.ex. bevakningskontexternas) första hämtning körs i en vanlig
  // effekt, som annars hinner före förälderns registrering.
  useLayoutEffect(() => registerAuthBridge({
    getToken: () => localStorage.getItem('si_token'),
    refresh: doRefresh,
  }), [doRefresh])

  // Schemalägg nästa refresh ~2 min innan access-token går ut. Körs om varje
  // gång token ändras (login/register/refresh) så nästa refresh läggs på nytt.
  // Golvet i beraknaRefreshFordrojning (bara för en nyss erhållen token) hindrar
  // en tät loop vid klockskillnad; en utgången token vid start refreshas direkt.
  useEffect(() => {
    if (!token) return
    const exp = decodeExp(token)
    if (exp === null) return
    const nu = Date.now()
    const msSedan = tokenErhallenRef.current === null ? null : nu - tokenErhallenRef.current
    const delay = beraknaRefreshFordrojning(exp, nu, decodeIat(token), msSedan)
    const timer = setTimeout(doRefresh, delay)
    return () => clearTimeout(timer)
  }, [token, doRefresh])

  async function login(email: string, password: string): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/login`, { email, password })
    applyTokens(data)
  }

  async function register(name: string, email: string, password: string, acceptedTerms: boolean): Promise<void> {
    const data = await authRequest(`${API_BASE}/api/auth/register`, { name, email, password, acceptedTerms })
    applyTokens(data)
  }

  async function loginWithGoogle(idToken: string, acceptedTerms: boolean): Promise<boolean> {
    const data = await authRequest(`${API_BASE}/api/auth/google`, { idToken, acceptedTerms })
    applyTokens(data)
    return data.isNewUser ?? false
  }

  function logout() {
    const rt = refreshTokenRef.current
    if (rt) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: rt }),
      }).catch(() => { /* best effort — sessionen rensas lokalt oavsett */ })
    }
    clearSession()
  }

  function byttVy(vy: SystemRoll) {
    localStorage.setItem('si_aktiv_vy', vy)
    setAktivVy(vy)
  }

  // Uppdaterar bara access-token lokalt (t.ex. efter PUT /api/auth/me, som
  // returnerar en färsk token med uppdaterade claims) — till skillnad från
  // doRefresh görs inget nätverksanrop, så det finns ingen risk att en
  // rate-limitad /api/auth/refresh-förfrågan loggar ut användaren mitt i en
  // helt orelaterad sparning.
  function setAccessToken(newToken: string) {
    localStorage.setItem('si_token', newToken)
    tokenErhallenRef.current = Date.now()
    sattToken(newToken)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, accessToken: token, roll, aktivVy, email, name, emailVerified, login, register, loginWithGoogle, logout, byttVy, refreshSession: doRefresh, setAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
