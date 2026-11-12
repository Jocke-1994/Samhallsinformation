import type { Source } from '../../../types'

// Samma shortName-gruppering som Sidebar.tsx redan använder för
// multi-feed-mönstret (session 15) — flera Source-rader (t.ex. "Polisen" +
// "Polisen Efterlysningar") delar shortName och ska visas som EN post.
export function grupperaKallor(sources: Source[]): Map<string, Source[]> {
  const grupper = new Map<string, Source[]>()
  for (const k of sources) {
    if (!grupper.has(k.shortName)) grupper.set(k.shortName, [])
    grupper.get(k.shortName)!.push(k)
  }
  return grupper
}

// Vilken källa i gruppen som representerar den visuellt: huvudkällan har
// alltid Name === ShortName (t.ex. "Polisen"/"Polisen", "SMHI"/"SMHI") —
// komplementkällor heter "<ShortName> Efterlysningar"/"<ShortName> Nyheter".
// Faller tillbaka till första källan om ingen exakt matchning finns.
export function representant(gruppkallor: Source[]): Source {
  return gruppkallor.find((k) => k.name === k.shortName) ?? gruppkallor[0]
}
