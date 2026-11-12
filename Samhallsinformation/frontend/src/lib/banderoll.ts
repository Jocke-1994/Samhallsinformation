import type { MaintenanceBanner } from '../api/maintenanceBanners'

// Stängs-nyckeln innehåller innehållet, inte bara id:t — annars skulle en
// admin-redigering av ett redan stängt meddelandes text/tider aldrig synas
// igen för den som redan stängt bort den ursprungliga texten. Stil, rubrik och
// länk ingår också, så att en "Kommer"-banderoll som byts till "Nytt" vid
// lanseringen visas en gång till även för den som stängde den första. En
// vanlig driftbanderoll behåller det gamla formatet, så att redan stängda
// meddelanden inte dyker upp igen bara för att den här koden ändrats.
export function bannerAvtryck(
  b: Pick<MaintenanceBanner, 'message' | 'startUtc' | 'endUtc' | 'stil' | 'rubrik' | 'lankUrl'>,
): string {
  const bas = `${b.message}|${b.startUtc}|${b.endUtc}`
  return b.stil === 'Drift' && !b.rubrik && !b.lankUrl
    ? bas
    : `${bas}|${b.stil}|${b.rubrik ?? ''}|${b.lankUrl ?? ''}`
}

// Samma regel som servern (MaintenanceBannersController.ArInternSokvag): bara
// sökvägar på sajten. Mellanslag och kontrolltecken nekas — webbläsaren stryker
// dem vid URL-tolkning, så "/<TAB>/evil.se" blir annars "//evil.se".
export function arInternSokvag(url: string): boolean {
  return (
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.includes('\\') &&
    // eslint-disable-next-line no-control-regex
    !/[\s\u0000-\u001f\u007f]/.test(url)
  )
}
