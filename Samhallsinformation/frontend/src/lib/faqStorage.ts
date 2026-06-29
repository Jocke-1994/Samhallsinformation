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
  { id: 1, kategori: 'Notifieringar', publicerad: true, fråga: 'Varför fick jag ingen notis?',                        svar: 'Kontrollera att rätt kanal (mail/SMS) är aktiverad under Notifieringar och att källan är tillagd under Mina källor. Det kan ta upp till 5 minuter innan en ny händelse når dig.' },
  { id: 2, kategori: 'Notifieringar', publicerad: true, fråga: 'Hur ändrar jag mitt SMS-nummer?',                     svar: 'Gå till Notifieringar → Standardinställningar. Där visas ditt registrerade nummer och du kan uppdatera det.' },
  { id: 3, kategori: 'Notifieringar', publicerad: true, fråga: 'Kan jag pausa notiser tillfälligt?',                  svar: 'Ja, avmarkera Mail och SMS i Standardinställningar under Notifieringar. Dina inställningar sparas och kan aktiveras igen när du vill.' },
  { id: 4, kategori: 'Mina källor',   publicerad: true, fråga: 'Hur lägger jag till fler källor?',                    svar: 'Gå till Mina källor i profilmenyn. Där kan du söka efter myndigheter eller hämta förslag automatiskt via SPAR.' },
  { id: 5, kategori: 'Mina källor',   publicerad: true, fråga: 'Kan jag följa flera myndigheter samtidigt?',          svar: 'Ja, du kan lägga till hur många källor du vill. Alla visas i ditt nyhetsflöde och du kan välja vilka du vill få notiser från.' },
  { id: 6, kategori: 'Konto',         publicerad: true, fråga: 'Hur tar jag bort mitt konto?',                        svar: 'Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras.' },
  { id: 7, kategori: 'Konto',         publicerad: true, fråga: 'Hur laddar jag ner min data?',                        svar: 'Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20).' },
  { id: 8, kategori: 'Uppdateringar', publicerad: true, fråga: 'Hur ser jag vad som är nytt i senaste versionen?',    svar: 'Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar med direktlänkar till berörda funktioner.' },
  { id: 9, kategori: 'Uppdateringar', publicerad: true, fråga: 'Hur rapporterar jag ett fel?',                        svar: 'Skapa ett nytt ärende via formuläret längre ner på den här sidan. Välj "Tekniskt fel på sidan" som ämne och beskriv vad som hänt.' },
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
