import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import Sidebar from '../components/Sidebar/Sidebar'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default function VillkorPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => { if (e.initial[0] < 30) setSidebarOpen(true) },
    onSwipedLeft:  ()  => setSidebarOpen(false),
    preventScrollOnSwipe: true,
    touchEventOptions: { passive: false },
  })

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        selectedShortName={null}
        onSelectSource={() => {}}
        viewMode="Allt"
        onSelectViewMode={() => {}}
        unreadSourceIds={new Set()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-y-auto select-none md:select-auto">
        <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Öppna meny"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-12">

          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Användarvillkor och integritetspolicy
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10">
            Senast uppdaterad: augusti 2026
          </p>

          <Section title="Tjänsten">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Samhällsinformation samlar och vidareförmedlar offentligt publicerad information
              från svenska myndigheter. Tjänsten skriver aldrig om, tolkar eller värderar
              innehållet — varje händelse länkar alltid till sin ursprungliga källa. Att skapa
              ett konto ger dig möjlighet att välja vilka myndigheter du vill följa och spara
              dina inställningar mellan besök.
            </p>
          </Section>

          <Section title="Vilka uppgifter vi samlar in">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              När du skapar ett konto lagrar vi namnet och e-postadressen du anger, samt en
              säkert hashad version av ditt lösenord (aldrig i klartext). Så länge du använder
              tjänsten sparar vi också:
            </p>
            <ul className="space-y-2">
              {[
                'Vilka källor du valt att följa',
                'Eventuella filter- och notifieringsinställningar du gör',
                'Grundläggande kontoaktivitet (t.ex. när inställningar ändras), för att kunna felsöka och stödja dig om något går fel',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Cookies och analys">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Tjänsten använder Google Analytics för att förstå hur sajten används, i aggregerad
              och anonymiserad form. Analys-cookies aktiveras endast om du godkänner det via
              cookie-bannern — nödvändiga cookies (t.ex. för att hålla dig inloggad) används
              alltid, eftersom tjänsten inte fungerar utan dem.
            </p>
          </Section>

          <Section title="Hur vi behandlar dina uppgifter">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Dina uppgifter delas aldrig med och säljs aldrig till tredje part. De används
              enbart för att driva tjänsten åt dig. Data lagras hos våra driftleverantörer inom
              EU. Vi vidtar rimliga tekniska åtgärder för att skydda dina uppgifter, men ingen
              tjänst kan garantera fullständig säkerhet.
            </p>
          </Section>

          <Section title="Dina rättigheter">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Du har rätt att få veta vilka uppgifter vi har om dig, att rätta felaktiga
              uppgifter, och att begära att ditt konto och dina uppgifter raderas. Kontakta oss
              (se nedan) för att utöva någon av dessa rättigheter — vi hanterar förfrågningar
              manuellt och återkommer så snart vi kan.
            </p>
          </Section>

          <Section title="Kontoavstängning">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              Vi förbehåller oss rätten att stänga av ett konto som missbrukar tjänsten, till
              exempel genom att:
            </p>
            <ul className="space-y-2 mb-3">
              {[
                'Skapa flera eller falska konton, t.ex. för att kringgå gränser för antal inloggningsförsök',
                'Skicka skräppost eller trakasserier via feedback-knappen eller kundtjänstboten',
                'Skrapa eller överbelasta tjänstens API automatiserat, utöver normal användning',
                'Försöka kringgå eller manipulera tjänstens säkerhetsfunktioner',
                'Använda tjänsten på ett sätt som bryter mot svensk lag',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Ditt konto raderas inte automatiskt vid en avstängning — kontakta oss om du tror
              att det skett av misstag.
            </p>
          </Section>

          <Section title="Ändringar">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Vi kan uppdatera de här villkoren över tid. Väsentliga ändringar meddelas i
              tjänsten. Genom att fortsätta använda tjänsten efter en uppdatering godkänner du
              de nya villkoren.
            </p>
          </Section>

          <Section title="Kontakt">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Har du frågor om de här villkoren eller om dina uppgifter, hör av dig via
              feedback-knappen i appen.
            </p>
          </Section>

        </div>
      </main>
    </div>
  )
}
