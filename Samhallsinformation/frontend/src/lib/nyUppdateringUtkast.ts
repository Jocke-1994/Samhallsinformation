import type { PunktRequest, PushSkickaVid } from '../api/uppdateringar'

// Osparat utkast för en NY uppdatering i admin. Ett klick utanför panelen eller
// på ✕ stängde tidigare formuläret och allt ifyllt försvann (2026-11-02).
// Utkastet ligger i webbläsaren tills det sparats på riktigt eller rensats.
// Redigering av en befintlig post sparas inte här — där finns redan en sparad
// version att gå tillbaka till.
export const UTKAST_NYCKEL = 'si_ny_uppdatering_utkast'

export interface NyUppdateringUtkast {
  titel: string; datum: string; punkter: PunktRequest[]
  schemalagd: boolean; schemaDatum: string; valdaFlaggor: string[]
  skickaPush: boolean; pushVersion: string; pushMeddelande: string
  visaBanderoll: boolean; visaVadArNytt: boolean
  annonsera: boolean; annonseDatum: string; pushSkickaVid: PushSkickaVid
}

export function läsUtkast(): NyUppdateringUtkast | null {
  try {
    const rå = localStorage.getItem(UTKAST_NYCKEL)
    return rå ? JSON.parse(rå) as NyUppdateringUtkast : null
  } catch { return null }
}

/** Tomt formulär = inget utkast att spara. */
export function sparaUtkast(utkast: NyUppdateringUtkast | null) {
  try {
    if (utkast) localStorage.setItem(UTKAST_NYCKEL, JSON.stringify(utkast))
    else localStorage.removeItem(UTKAST_NYCKEL)
  } catch { /* privat läge m.m. — formuläret fungerar ändå */ }
}

export function rensaUtkast() { sparaUtkast(null) }
