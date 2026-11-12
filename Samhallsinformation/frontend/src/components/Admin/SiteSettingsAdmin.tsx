import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSiteSettings, updateSiteSettings, type SiteSettings } from '../../api/siteSettings'
import ConfirmDialog from '../common/ConfirmDialog'

type Inställning = keyof SiteSettings

const ETIKETT: Record<Inställning, string> = {
  showLoginButton: 'Logga in-knappen',
  showRegisterButton: 'Skapa konto-knappen',
}

export default function SiteSettingsAdmin() {
  const queryClient = useQueryClient()
  const [väntande, setVäntande] = useState<{ fält: Inställning; nyttVärde: boolean } | null>(null)

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['site-settings'],
    queryFn: getSiteSettings,
  })

  const updateMutation = useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: (updated) => queryClient.setQueryData(['site-settings'], updated),
  })

  // Okänt läge (laddar, laddfel eller aldrig hämtat): visa aldrig en gissning
  // och skicka aldrig en inverterad gissning. Reglagen är då inaktiverade.
  const läget = !isError && data ? data : null
  const inaktiverad = läget === null || updateMutation.isPending

  function begärÄndring(fält: Inställning) {
    if (!läget) return
    setVäntande({ fält, nyttVärde: !läget[fält] })
  }

  function bekräftaÄndring() {
    if (!väntande) return
    const { fält, nyttVärde } = väntande
    setVäntande(null)
    updateMutation.mutate({ [fält]: nyttVärde })
  }

  function rad(fält: Inställning, titel: string, beskrivning: string) {
    const på = läget?.[fält]
    return (
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-700">{titel}</span>
          <span className="text-xs text-slate-400">{beskrivning}</span>
        </div>
        <button
          onClick={() => begärÄndring(fält)}
          disabled={inaktiverad}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-6 disabled:opacity-50 ${
            på ? 'bg-violet-600' : 'bg-slate-300'
          }`}
          aria-label={
            läget === null ? `${titel} — okänt läge` : `${på ? 'Dölj' : 'Visa'} ${ETIKETT[fält]}`
          }
          role="switch"
          aria-checked={läget === null ? undefined : på}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              på ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          Logga in / Skapa konto-knappar
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
            LIVE
          </span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Global inställning — gäller direkt för ALLA besökare, till skillnad från de gamla
          funktions-flaggorna som bara påverkade din egen webbläsare.
        </p>
      </div>

      {isError && (
        <div
          role="alert"
          className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm text-red-700">Kunde inte läsa inställningen.</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm font-medium text-red-700 hover:text-red-900 underline disabled:opacity-50"
          >
            Försök igen
          </button>
        </div>
      )}

      {updateMutation.isError && (
        <div
          role="alert"
          className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
        >
          <p className="text-sm text-red-700">Ändringen kunde inte sparas. Inget har ändrats.</p>
        </div>
      )}

      {isLoading && <p className="px-6 pt-4 text-xs text-slate-400">Läser inställningen…</p>}

      <div className="divide-y divide-slate-50">
        {rad('showLoginButton', 'Visa Logga in-knapp', 'Synlig i sidomenyn för utloggade besökare')}
        {rad(
          'showRegisterButton',
          'Visa Skapa konto-knapp',
          'Synlig i sidomenyn för utloggade besökare',
        )}
      </div>

      {väntande && (
        <ConfirmDialog
          rubrik={`${väntande.nyttVärde ? 'Visa' : 'Dölj'} ${ETIKETT[väntande.fält]} för alla besökare?`}
          bekräftaText={väntande.nyttVärde ? 'Visa för alla' : 'Dölj för alla'}
          destruktiv={!väntande.nyttVärde}
          onBekräfta={bekräftaÄndring}
          onAvbryt={() => setVäntande(null)}
        >
          <p>
            Det här är en global inställning som slår igenom direkt för{' '}
            <strong>alla besökare</strong>.
            {!väntande.nyttVärde &&
              ' Utloggade besökare kan då inte längre nå den här vägen in via sidomenyn.'}
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}
