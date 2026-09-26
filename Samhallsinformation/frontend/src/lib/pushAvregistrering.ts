import { unsubscribeDeviceMedToken } from '../api/push'

// Vid utloggning/sessionsslut ska den här webbläsarens push-prenumeration inte
// överleva användaren: annars fortsätter nästa användare (eller en utloggad
// gäst) på samma enhet få den förras notiser. Två oberoende steg, båda best
// effort — inget av dem får blockera utloggningen eller kasta:
//  1. servern raderar enhetsraden (kräver användarens token, som därför
//     skickas in explicit — sessionen är redan rensad när det här körs),
//  2. webbläsaren släpper själva prenumerationen.
// Steg 2 körs även om steg 1 misslyckas (t.ex. utgången token vid sessionsslut);
// servern städar då bort den döda endpointen när leveransen ger 404/410.
//
// getRegistration() i stället för serviceWorker.ready: ready löses aldrig om
// ingen service worker är registrerad, och utloggningen ska aldrig hänga.
export async function avregistreraPushEnhet(token: string | null): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const registrering = await navigator.serviceWorker.getRegistration()
    const prenumeration = await registrering?.pushManager?.getSubscription()
    if (!prenumeration) return

    const endpoint = prenumeration.endpoint
    // allSettled: ett fel i det ena stoppar inte det andra, och inget kastas.
    await Promise.allSettled([
      (async () => { if (token) await unsubscribeDeviceMedToken(endpoint, token) })(),
      (async () => { await prenumeration.unsubscribe() })(),
    ])
  } catch {
    /* best effort — utloggningen påverkas aldrig */
  }
}
