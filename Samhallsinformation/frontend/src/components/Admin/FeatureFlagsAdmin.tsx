import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FLAG_GRUPPER, FLAG_DEFINITIONER, type FlagKey, type FlagState } from '../../lib/featureFlags'
import ConfirmDialog from '../common/ConfirmDialog'
import { MockBadge } from '../common/MockBadge'
import { fetchAdminFeatureFlags, setFeatureFlagRedo } from '../../api/featureFlags'
import { ADMIN_FLAGG_QUERY_KEY, invalideraFlaggor } from '../../lib/flaggCache'
import type { FlaggLäge } from '../../hooks/useFeatureFlags'
import { HamtningsFel, MutationFel } from '../common/HamtningsStatus'

interface Props {
  flaggor: FlagState
  onVäxla: (key: FlagKey) => void
  onÅterställ: () => void
  /** 'fel' = flaggornas läge gick inte att hämta; det som visas är senast känt/standard. */
  läge?: FlaggLäge
  /** Felet från senaste misslyckade växling/återställning. */
  ändringsFel?: unknown
  ändringPågår?: boolean
}

export default function FeatureFlagsAdmin({ flaggor, onVäxla, onÅterställ, läge, ändringsFel, ändringPågår }: Props) {
  const [öppna, setÖppna] = useState<Set<string>>(new Set())
  const [bekräftaÅterställ, setBekräftaÅterställ] = useState(false)
  const queryClient = useQueryClient()

  // Redo-markeringen (schemaläggs i Uppdateringar) hör inte till den
  // publika flagg-kontexten — hämtas separat bara för den här panelen.
  const adminFråga = useQuery({
    queryKey: ADMIN_FLAGG_QUERY_KEY,
    queryFn:  fetchAdminFeatureFlags,
  })
  const adminFlaggor = adminFråga.data ?? []
  // Utan hämtad lista är "redo"-markeringarna okända — inte "ingen är markerad".
  const redoOkänt = adminFråga.data === undefined
  const redoMap: Record<string, boolean> = Object.fromEntries(
    adminFlaggor.map(f => [f.key, f.redoAttLanseras])
  )

  const redoMutation = useMutation({
    mutationFn: ({ key, redo }: { key: string; redo: boolean }) => setFeatureFlagRedo(key, redo),
    onSuccess: () => invalideraFlaggor(queryClient),
  })
  const växlaRedo = redoMutation.mutate

  function växlaGrupp(key: string) {
    setÖppna(prev => {
      const ny = new Set(prev)
      if (ny.has(key)) ny.delete(key)
      else ny.add(key)
      return ny
    })
  }

  const totalAktiva = Object.values(flaggor).filter(Boolean).length
  const total = Object.keys(flaggor).length

  // Flaggor vars nuvarande värde avviker från kodens standard — det är dessa
  // som faktiskt ändras för alla besökare när overrides tas bort.
  const ändras = FLAG_DEFINITIONER.filter(f => flaggor[f.key] !== f.defaultAktiv)

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{totalAktiva} av {total} funktioner aktiverade</p>
        <button
          onClick={() => setBekräftaÅterställ(true)}
          className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Återställ standardvärden för alla
        </button>
      </div>

      {läge === 'fel' && (
        <HamtningsFel
          fel={null}
          reserv="Kunde inte hämta flaggornas aktuella läge. Reglagen visar senast kända värden (eller standardvärden) och kan vara fel."
          onForsokIgen={() => invalideraFlaggor(queryClient)}
          className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4"
        />
      )}
      {adminFråga.isError && redoOkänt && läge !== 'fel' && (
        <HamtningsFel
          fel={adminFråga.error}
          reserv={'Kunde inte hämta "Redo att lanseras"-markeringarna. De visas som omarkerade men är okända.'}
          onForsokIgen={() => { void adminFråga.refetch() }}
          arIgang={adminFråga.isFetching}
          className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4"
        />
      )}
      <MutationFel fel={ändringsFel} reserv="Ändringen kunde inte sparas. Flaggan är oförändrad — försök igen." className="bg-red-50 border border-red-200 rounded-xl px-5 py-3" />
      <MutationFel fel={redoMutation.error} reserv={'"Redo att lanseras"-markeringen kunde inte sparas. Försök igen.'} className="bg-red-50 border border-red-200 rounded-xl px-5 py-3" />

      {bekräftaÅterställ && (
        <ConfirmDialog
          rubrik="Återställa standardvärden för alla besökare?"
          bekräftaText="Återställ för alla"
          onBekräfta={() => { setBekräftaÅterställ(false); onÅterställ() }}
          onAvbryt={() => setBekräftaÅterställ(false)}
        >
          <p>
            Alla flaggors overrides tas bort, även markeringarna "Redo att lanseras". Flaggorna är
            globala: funktioner kan slås av eller på för <strong>alla användare</strong> direkt.
          </p>
          {ändras.length === 0 ? (
            <p>Just nu avviker ingen flagga från standardvärdet.</p>
          ) : (
            <>
              <p><strong>{ändras.length}</strong> {ändras.length === 1 ? 'flagga ändras' : 'flaggor ändras'}:</p>
              <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                {ändras.map(f => (
                  <li key={f.key}>{f.label}: {flaggor[f.key] ? 'på' : 'av'} → {f.defaultAktiv ? 'på' : 'av'}</li>
                ))}
              </ul>
            </>
          )}
        </ConfirmDialog>
      )}

      {/* Accordion-kort */}
      <div className="flex flex-col gap-3">
        {FLAG_GRUPPER.map(grupp => {
          const öppen = öppna.has(grupp.key)
          const aktivaIGrupp = grupp.flaggor.filter(f => flaggor[f.key]).length
          const totalIGrupp = grupp.flaggor.length
          const allaAktiva = aktivaIGrupp === totalIGrupp

          return (
            <div key={grupp.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">

              {/* Kort-header */}
              <button
                onClick={() => växlaGrupp(grupp.key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{grupp.ikon}</span>
                  <span className="text-sm font-semibold text-slate-800">{grupp.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    allaAktiva ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {aktivaIGrupp}/{totalIGrupp} aktiva
                  </span>
                </div>
                <span className={`text-slate-400 text-xs transition-transform duration-200 ${öppen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Under-flaggor */}
              {öppen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {grupp.flaggor.map(flagga => {
                    const aktiv = flaggor[flagga.key]
                    return (
                      <div
                        key={flagga.key}
                        className={`flex items-center justify-between px-5 py-3 transition-colors ${
                          aktiv ? '' : 'opacity-50'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            {flagga.label}
                            {flagga.mock && <MockBadge />}
                          </span>
                          <span className="text-xs text-slate-400">{flagga.beskrivning}</span>
                          {flagga.mock && (
                            <span className="text-xs text-amber-700">
                              Mock-UI utan backend — visas aldrig för användare i produktion, inte ens när flaggan är på.
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-6">
                          {!aktiv && !flagga.mock && (
                            <button
                              onClick={() => växlaRedo({ key: flagga.key, redo: !redoMap[flagga.key] })}
                              disabled={redoOkänt || redoMutation.isPending}
                              className={`text-[11px] font-medium px-2 py-1 rounded-full border transition-colors ${
                                redoMap[flagga.key]
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                              }`}
                              title="Styr om flaggan dyker upp i Uppdateringars schemaläggningslista"
                            >
                              {redoMap[flagga.key] ? '✓ Redo att lanseras' : 'Redo att lanseras?'}
                            </button>
                          )}
                          <button
                            onClick={() => onVäxla(flagga.key)}
                            disabled={ändringPågår}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
                              aktiv ? 'bg-violet-600' : 'bg-slate-300'
                            }`}
                            aria-label={`${aktiv ? 'Inaktivera' : 'Aktivera'} ${flagga.label}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                              aktiv ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}
