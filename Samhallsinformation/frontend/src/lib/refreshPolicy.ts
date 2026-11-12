// Ren beslutslogik för refresh av access-token. Ligger utanför AuthContext så
// att den kan enhetstestas utan att rendera något.

// Hur lång tid innan access-token går ut som en ny hämtas
export const REFRESH_MARGIN_MS = 2 * 60 * 1000

// Golv på väntetiden till nästa schemalagda refresh, men BARA för en token som
// nyss erhållits (login/register/refresh). Access-token utfärdas av servern
// (dess klocka) men jämförs med klientens Date.now(); går enhetens klocka mer
// än ~13 min före blir den absoluta väntetiden 0 även för en färsk token och
// refresh skulle bli en tät loop som slår i /refresh-taket (auth-policyn, 5
// anrop/min). Golvet gör att det värsta fallet är 2 anrop/min. En token som
// lästs in ur localStorage vid start (t.ex. återvändande användare med utgången
// token) ska däremot refreshas direkt, utan golv.
export const MIN_REFRESH_FORDROJNING_MS = 30 * 1000

// Retry vid tillfälliga fel: exponentiell backoff med tak, och ett max antal
// försök per cykel så att vi inte hamrar på en server som ligger nere.
export const RETRY_BAS_MS = 10 * 1000
export const RETRY_TAK_MS = 2 * 60 * 1000
export const MAX_REFRESH_FORSOK = 6

export type RefreshAtgard = 'loggaUt' | 'forsokIgen'

// status === null betyder att fetch kastade (nätverksfel, timeout, offline).
// Servern avvisar refresh-token med 401 (ogiltig/återkallad/utgången) eller
// 403 (avstängt konto, se AuthService.RefreshAsync) — bara då är sessionen
// verkligen slut. 429, 5xx och nätverksfel säger inget om token: behåll den.
export function beslutaAtgardVidFel(status: number | null): RefreshAtgard {
  return status === 401 || status === 403 ? 'loggaUt' : 'forsokIgen'
}

// Antal ms att vänta innan försök nummer `forsok` (1 = första omförsöket).
// Retry-After (sekunder) respekteras som golv men kapas så en felaktig header
// inte parkerar sessionen i timmar.
export function beraknaRetryFordrojning(forsok: number, retryAfter: string | null = null): number {
  const backoff = Math.min(RETRY_BAS_MS * 2 ** Math.max(0, forsok - 1), RETRY_TAK_MS)
  const text = retryAfter?.trim() ?? ''
  if (!/^\d+$/.test(text)) return backoff
  return Math.max(backoff, Math.min(Number(text) * 1000, RETRY_TAK_MS))
}

// exp, nu och iat i ms. msSedanSenasteRefresh = tid sedan token senast erhölls
// från servern (null om den lästes ur localStorage vid start). Golvet gäller
// bara när den är < MIN_REFRESH_FORDROJNING_MS. Om token bär iat (utfärdandetid)
// kapas väntetiden också av token-livslängden (exp - iat), så att en klocka som
// går efter inte skjuter refresh bortom token-livslängden. Idag utfärdar
// backend ingen iat.
export function beraknaRefreshFordrojning(
  exp: number,
  nu: number,
  iat: number | null = null,
  msSedanSenasteRefresh: number | null = null,
): number {
  let fordrojning = exp - nu - REFRESH_MARGIN_MS
  if (iat !== null && exp > iat) {
    fordrojning = Math.min(fordrojning, exp - iat - REFRESH_MARGIN_MS)
  }
  const nyligenErhallen =
    msSedanSenasteRefresh !== null && msSedanSenasteRefresh < MIN_REFRESH_FORDROJNING_MS
  return Math.max(nyligenErhallen ? MIN_REFRESH_FORDROJNING_MS : 0, fordrojning)
}
