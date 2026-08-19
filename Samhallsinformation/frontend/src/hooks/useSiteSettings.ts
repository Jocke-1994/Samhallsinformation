import { useQuery } from '@tanstack/react-query'
import { getSiteSettings } from '../api/siteSettings'

/**
 * Global, databas-backad sidinställning (t.ex. om Logga in/Skapa konto-knapparna
 * ska visas för utloggade besökare). Till skillnad från de gamla feature-flaggorna
 * (`lib/featureFlags.ts`, per webbläsare via localStorage) gäller den här för ALLA
 * besökare direkt. Delar react-query-cache (queryKey `site-settings`) mellan
 * Sidebar och admin-panelen, så en admin-ändring syns direkt utan extra koppling.
 */
export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: getSiteSettings,
    staleTime: 5 * 60_000,
  })

  return {
    showLoginButton: data?.showLoginButton ?? true,
    showRegisterButton: data?.showRegisterButton ?? true,
    loading: isLoading,
  }
}
