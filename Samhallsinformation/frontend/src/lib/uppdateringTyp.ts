import type { PunktTyp } from '../api/uppdateringar'

// Gemensam presentation för Uppdateringar-punktens `typ`. Tidigare fanns fem
// kopior (Nyheter-sidan, Profil-fliken, admin) som alla gjorde `TYP_CONFIG[typ]`
// utan fallback — en okänd `typ` (t.ex. gammalt "nytt", tom sträng) gav
// `undefined.label` och vit skärm (PR #583, V2-7). Använd alltid getTypConfig.

export interface TypConfig {
  /** Etikett för besökare/inloggade (Nyheter-sidan, Profil → Uppdateringar). */
  label: string
  /** Etikett i adminpanelen. */
  adminLabel: string
  /** Liten färgad badge (Nyheter-sidan, Profil → Uppdateringar). */
  badge: string
  /** Admin: typ-piller i formuläret, inte vald. */
  formPill: string
  /** Admin: typ-piller i formuläret, vald. */
  formPillAktiv: string
  /** Admin: piller i listan/filtret. */
  listPill: string
  dot: string
}

const FORM_PILL = 'border-slate-200 text-slate-500 hover:bg-slate-50'

const TYP_CONFIG: Record<PunktTyp, TypConfig> = {
  'ny-funktion': {
    label: 'Nytt',
    adminLabel: 'Ny funktion',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    formPill: FORM_PILL,
    formPillAktiv: 'bg-violet-100 text-violet-700 border-violet-200',
    listPill: 'bg-violet-100 text-violet-700 border border-violet-200',
  },
  förbättring: {
    label: 'Förbättrat',
    adminLabel: 'Förbättring',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
    formPill: FORM_PILL,
    formPillAktiv: 'bg-amber-100 text-amber-700 border-amber-200',
    listPill: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  buggfix: {
    label: 'Fixat',
    adminLabel: 'Buggfix',
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    formPill: FORM_PILL,
    formPillAktiv: 'bg-green-100 text-green-700 border-green-200',
    listPill: 'bg-green-100 text-green-700 border border-green-200',
  },
  'känt-problem': {
    label: 'Känt problem',
    adminLabel: 'Känt problem',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    formPill: FORM_PILL,
    formPillAktiv: 'bg-red-100 text-red-700 border-red-200',
    listPill: 'bg-red-100 text-red-700 border border-red-200',
  },
  'kommer-snart': {
    label: 'Kommer snart',
    adminLabel: 'Kommer snart',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    formPill: FORM_PILL,
    formPillAktiv: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    listPill: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
}

/** Ordningen typerna visas i (formulär/filter). */
export const PUNKT_TYPER = Object.keys(TYP_CONFIG) as PunktTyp[]

// Neutral stil för en okänd typ — ingen krasch, ingen felaktig färgkodning.
const OKAND_TYP: TypConfig = {
  label: 'Övrigt',
  adminLabel: 'Övrigt',
  badge: 'bg-slate-100 text-slate-600',
  formPill: FORM_PILL,
  formPillAktiv: 'bg-slate-100 text-slate-700 border-slate-200',
  listPill: 'bg-slate-100 text-slate-600 border border-slate-200',
  dot: 'bg-slate-400',
}

/**
 * Slår upp presentationen för en punkt-typ. Tar `string | null | undefined`
 * eftersom backend returnerar redan lagrade rader oförändrade, även om de har
 * en typ utanför PunktTyp. Använder hasOwn så att t.ex. "constructor" inte
 * råkar matcha via prototypkedjan.
 */
export function getTypConfig(typ: string | null | undefined): TypConfig {
  return typ != null && Object.hasOwn(TYP_CONFIG, typ) ? TYP_CONFIG[typ as PunktTyp] : OKAND_TYP
}
