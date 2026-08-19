import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSiteSettings, updateSiteSettings } from '../../api/siteSettings'

export default function SiteSettingsAdmin() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['site-settings'],
    queryFn: getSiteSettings,
  })

  const updateMutation = useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: (updated) => queryClient.setQueryData(['site-settings'], updated),
  })

  const showLoginButton = data?.showLoginButton ?? true
  const showRegisterButton = data?.showRegisterButton ?? true

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          Logga in / Skapa konto-knappar
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Global inställning — gäller direkt för ALLA besökare, till skillnad från de gamla
          funktions-flaggorna som bara påverkade din egen webbläsare.
        </p>
      </div>

      {isError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">Kunde inte hämta inställningen från backend.</p>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Visa Logga in-knapp</span>
            <span className="text-xs text-slate-400">Synlig i sidomenyn för utloggade besökare</span>
          </div>
          <button
            onClick={() => updateMutation.mutate({ showLoginButton: !showLoginButton })}
            disabled={isLoading || updateMutation.isPending}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-6 disabled:opacity-50 ${
              showLoginButton ? 'bg-violet-600' : 'bg-slate-300'
            }`}
            aria-label={`${showLoginButton ? 'Dölj' : 'Visa'} Logga in-knappen`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              showLoginButton ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Visa Skapa konto-knapp</span>
            <span className="text-xs text-slate-400">Synlig i sidomenyn för utloggade besökare</span>
          </div>
          <button
            onClick={() => updateMutation.mutate({ showRegisterButton: !showRegisterButton })}
            disabled={isLoading || updateMutation.isPending}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-6 disabled:opacity-50 ${
              showRegisterButton ? 'bg-violet-600' : 'bg-slate-300'
            }`}
            aria-label={`${showRegisterButton ? 'Dölj' : 'Visa'} Skapa konto-knappen`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              showRegisterButton ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
    </div>
  )
}
