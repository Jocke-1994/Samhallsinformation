// Bro mellan AuthProvider (React) och API-lagret. API-lagret får inte importera
// React-kontext, så AuthProvider registrerar de två funktioner adminFetch
// behöver: hur man läser aktuell access-token och hur man förnyar den via
// samma single-flight-refresh som AuthProvider själv använder (timern,
// refreshSession). Utloggning vid ett avvisat refresh-token äger fortfarande
// AuthProvider (V1-4) — bron gör bara att ett 401 kan trigga en förnyelse.

export interface AuthBridge {
  getToken: () => string | null
  // Förnyar sessionen. Löser sig när försöket är klart oavsett utgång; om det
  // lyckades har getToken() därefter en ny token.
  refresh: () => Promise<void>
}

const standardBro: AuthBridge = {
  getToken: () => localStorage.getItem('si_token'),
  refresh: () => Promise.resolve(),
}

let bro: AuthBridge = standardBro

// Returnerar en avregistreringsfunktion (för cleanup i useLayoutEffect).
export function registerAuthBridge(ny: AuthBridge): () => void {
  bro = ny
  return () => {
    if (bro === ny) bro = standardBro
  }
}

export function hamtaAktuellToken(): string | null {
  return bro.getToken()
}

// Ett pågående förnyelseförsök delas av alla anrop som får 401 samtidigt, så
// att t.ex. fem parallella queries ger EN refresh (refresh-token roteras vid
// varje anrop och /refresh har ett strikt tak).
let pagaende: Promise<string | null> | null = null

// Anropas efter ett 401 på ett anrop som skickades med `avvisadToken`.
// Returnerar en token att göra om anropet med, eller null om det inte finns
// någon (sessionen är slut eller förnyelsen misslyckades) — då ska det
// ursprungliga 401-svaret bara returneras som det är.
export async function fornyaEfter401(avvisadToken: string): Promise<string | null> {
  // Redan förnyad av timern eller ett annat anrop medan det här var på väg.
  const nu = bro.getToken()
  if (nu && nu !== avvisadToken) return nu

  if (!pagaende) {
    const aktuell = bro
    pagaende = aktuell
      .refresh()
      .catch(() => {
        /* utfallet avgörs av om en ny token finns nedan */
      })
      .then(() => aktuell.getToken())
      .finally(() => {
        pagaende = null
      })
  }
  const ny = await pagaende
  return ny && ny !== avvisadToken ? ny : null
}
