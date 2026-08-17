import type { FaqKategori } from '../types'

export interface AdminFaqItem {
  id:         number
  kategori:   FaqKategori
  publicerad: boolean
  fråga:      string
  svar:       string
}

const STORAGE_KEY = 'si_faq_items'

export const INITIAL_FAQ: AdminFaqItem[] = [
  { id: 1, kategori: 'Konto', publicerad: false, fråga: 'Varför fick jag ingen push-notis?',    svar: 'Kontrollera att push-notiser är aktiverat under Konto → Push-notiser, och att kategorin Ny händelse är påslagen. Se också till att källan finns under Mina källor, och att din webbläsare/enhet tillåter notiser från sidan.' },
  { id: 2, kategori: 'Konto', publicerad: false, fråga: 'Hur aktiverar jag push-notiser?',       svar: 'Gå till Konto → Push-notiser och slå på Ny händelse för att få en notis när dina källor i Mitt flöde publicerar något nytt. Ingen separat "aktivera push"-knapp behövs — att slå på kategorin startar prenumerationen automatiskt.' },
  { id: 3, kategori: 'Konto', publicerad: false, fråga: 'Kan jag pausa notiser tillfälligt?',    svar: 'Ja, stäng av Ny händelse under Konto → Push-notiser. Webbläsarens push-prenumeration avslutas automatiskt, och startas om nästa gång du slår på den igen.' },
  { id: 4, kategori: 'Mina källor',   publicerad: true, fråga: 'Hur lägger jag till fler källor?',                    svar: 'Gå till Mina källor i profilmenyn. Där kan du söka efter och lägga till de myndigheter som finns tillgängliga.' },
  { id: 5, kategori: 'Mina källor',   publicerad: true, fråga: 'Kan jag följa flera myndigheter samtidigt?',          svar: 'Ja, du kan lägga till hur många källor du vill i Mina källor. Alla visas i ditt nyhetsflöde.' },
  { id: 6, kategori: 'Konto',         publicerad: false, fråga: 'Hur tar jag bort mitt konto?',                       svar: 'Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras.' },
  { id: 7, kategori: 'Konto',         publicerad: false, fråga: 'Hur laddar jag ner min data?',                       svar: 'Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20).' },
  { id: 8, kategori: 'Uppdateringar', publicerad: false, fråga: 'Hur ser jag vad som är nytt i senaste versionen?',    svar: 'Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar sedan förra uppdateringen.' },
  { id: 9, kategori: 'Uppdateringar', publicerad: true, fråga: 'Hur rapporterar jag ett fel?',                        svar: 'Klicka på Feedback-knappen längst ner i sidomenyn och beskriv vad som hänt. Meddelandet skickas till oss, och du kan ange din e-post om du vill ha svar.' },
]

export function laddaFaq(): AdminFaqItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed: AdminFaqItem[] = JSON.parse(stored)
      // Lägg till nya frågor från INITIAL_FAQ som saknas i sparad data
      const sparadeIds = new Set(parsed.map(f => f.id))
      const nyaTillkomna = INITIAL_FAQ.filter(f => !sparadeIds.has(f.id))
      return [...parsed, ...nyaTillkomna]
    }
  } catch {}
  return INITIAL_FAQ
}

export function sparaFaq(items: AdminFaqItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}
