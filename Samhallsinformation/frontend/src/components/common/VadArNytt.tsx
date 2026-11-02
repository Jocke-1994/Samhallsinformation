import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useFlags } from '../../context/FeatureFlagsContext'
import { fetchVadArNytt, markeraVadArNyttSett, type UppdateringsPunkt } from '../../api/uppdateringar'
import { getTypConfig } from '../../lib/uppdateringTyp'
import type { FlagState } from '../../lib/featureFlags'
import ProvaSjalvLank from './ProvaSjalvLank'
import VersionsBricka from '../Uppdateringar/VersionsBricka'

// Sidor där rutan aldrig ska störa: adminpanelen och inloggnings-/kontoflödena.
const DOLD_PÅ = ['/admin', '/login', '/register', '/forgot-password', '/reset-password',
  '/verify-email', '/confirm-email-change', '/cancel-deletion']

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Vad är nytt-rutan (Ideer/Vad ar nytt-modal.md, variant B "diskret kort",
 * godkänd 2026-11-02). Kort i nedre hörnet på dator, ark från botten på mobil,
 * ingen mörk bakgrund — flödet bakom går att använda. Bara inloggade; vad som
 * visas och om det redan setts avgör backend (GET /api/uppdateringar/vad-ar-nytt).
 * "Har sett" sparas på kontot, så att stänga på datorn gäller även mobilen.
 */
export default function VadArNytt() {
  const { isLoggedIn, email } = useAuth()
  const flaggor = useFlags()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const rubrikId = useId()
  const [stängdId, setStängdId] = useState<string | null>(null)

  const aktiv = isLoggedIn && flaggor.uppdateringar_vad_ar_nytt

  // Nycklad per konto: loggar någon annan in i samma webbläsare ska den
  // förra personens svar aldrig visas.
  const queryKey = ['vad-ar-nytt', email] as const
  const { data } = useQuery({
    queryKey,
    queryFn:  fetchVadArNytt,
    enabled:  aktiv,
    staleTime: 10 * 60_000,
  })

  const sett = useMutation({
    mutationFn: markeraVadArNyttSett,
    onSuccess:  () => queryClient.setQueryData(queryKey, null),
  })

  const synlig = aktiv && data != null && data.id !== stängdId && !DOLD_PÅ.some(p => pathname.startsWith(p))

  function stäng() {
    if (!data) return
    // Döljs direkt, även om anropet skulle misslyckas — då kommer rutan
    // bara tillbaka vid nästa sidladdning, vilket är ofarligt.
    setStängdId(data.id)
    sett.mutate(data.id)
  }

  useEffect(() => {
    if (!synlig) return
    function vidTangent(e: KeyboardEvent) { if (e.key === 'Escape') stäng() }
    document.addEventListener('keydown', vidTangent)
    return () => document.removeEventListener('keydown', vidTangent)
  })

  if (!synlig || !data) return null

  return (
    <section
      role="dialog"
      aria-labelledby={rubrikId}
      // Kundtjänstbotens widget (lumio, extern) har z-index 99997–99999 och
      // täcker nedre högra hörnet upp till ~134px. Mobil: arket ligger ÖVER
      // den medan det är öppet (ett bottenark kan inte undvika bubblan; den
      // kommer tillbaka direkt vid Stäng). Dator: kortet ligger under widgetens
      // z-nivå men flyttat ovanför pratbubblan, så båda syns utan överlapp.
      className="fixed z-[100000] bg-white border border-slate-200 shadow-2xl
                 inset-x-0 bottom-0 rounded-t-2xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]
                 sm:z-[9050] sm:inset-x-auto sm:right-6 sm:bottom-40 sm:w-[360px] sm:rounded-2xl sm:p-5"
    >
      <VadArNyttInnehall titel={data.titel} datum={data.datum} punkter={data.punkter} version={data.version} rubrikId={rubrikId} onStäng={stäng} />
    </section>
  )
}

/**
 * Själva innehållet i rutan, utan placering. Delas med förhandsvisningen i
 * admin (UppdateringForhandsvisning) så att den visar exakt samma sak.
 */
export function VadArNyttInnehall({ titel, datum, punkter, rubrikId, onStäng, förhandsvisning, version }: {
  titel: string
  datum: string
  version?: string | null
  punkter: UppdateringsPunkt[]
  rubrikId?: string
  onStäng: () => void
  /** Admins förhandsvisning: Prova själv-länkarna visas som för en inloggad med lanseringens flaggor. */
  förhandsvisning?: { flaggor: Partial<FlagState> }
}) {
  return (
    <>
    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
    <button
      type="button"
      onClick={onStäng}
      aria-label="Stäng Vad är nytt"
      className="absolute right-3 top-3 h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
    >
      ✕
    </button>

    <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Vad är nytt</p>
    <h2 id={rubrikId} className="mt-1 pr-8 text-lg font-semibold leading-snug text-slate-900">{titel}</h2>
    <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500"><VersionsBricka version={version} />{formatDatum(datum)}</p>

    <ul className="mt-4 flex max-h-[40vh] flex-col gap-3 overflow-y-auto">
      {punkter.map(p => {
        const typ = getTypConfig(p.typ)
        return (
          <li key={p.id} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
            <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${typ.badge}`}>{typ.label}</span>
            <div className="flex flex-col">
              <span>{p.text}</span>
              {/* Ett klick räknas som att rutan är sedd, precis som "Läs mer". */}
              <ProvaSjalvLank mål={p.provaSjalv} onKlick={onStäng}
                förhandsvisning={förhandsvisning ? { inloggad: true, flaggor: förhandsvisning.flaggor } : undefined} />
            </div>
          </li>
        )
      })}
    </ul>

    <div className="mt-5 flex items-center justify-between gap-3">
      <Link
        to="/uppdateringar"
        onClick={onStäng}
        className="text-sm text-violet-700 underline underline-offset-4 dark:text-violet-300"
      >
        Se alla nyheter
      </Link>
      <button
        type="button"
        onClick={onStäng}
        className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
      >
        Stäng
      </button>
    </div>
    </>
  )
}
