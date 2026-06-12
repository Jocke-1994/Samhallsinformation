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

export default function OmPage() {
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
        selectedSourceId={null}
        onSelectSource={() => {}}
        unreadSourceIds={new Set()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-y-auto select-none md:select-auto">
        {/* Hamburger — mobil */}
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
            Om Samhällsinformation
          </h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
            Samhällsinformation är en oberoende tjänst som samlar och presenterar offentlig
            information från svenska myndigheter på en gemensam plats. Syftet är att göra
            myndighetsinformation mer tillgänglig — inte att kommentera, tolka eller värdera den.
          </p>

          <Section title="Vad tjänsten gör">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Tjänsten hämtar automatiskt publicerat material från anslutna myndigheter och
              presenterar det i ett samlat flöde. Inget innehåll skapas, omformuleras eller
              värderas av tjänsten. All information visas exakt som den publicerats av
              respektive källa.
            </p>
          </Section>

          <Section title="Principer">
            <ul className="space-y-2.5">
              {[
                'Ingen information visas utan en verifierad primär källa.',
                'Innehåll omformuleras aldrig.',
                'Tjänsten tar inte ställning i enskilda händelser eller frågor.',
                'Det är alltid tydligt varifrån en uppgift kommer.',
                'Alla länkar leder direkt till ursprungskällan — ingen information presenteras utan att originalet är länkat.',
              ].map(princip => (
                <li key={princip} className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className="leading-relaxed">{princip}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Källor">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Tjänsten hämtar för närvarande information från:
            </p>
            <ul className="space-y-2">
              {['Polisen', 'Krisinformation (MSB)'].map(källa => (
                <li key={källa} className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  {källa}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Integritet &amp; cookies">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Tjänsten använder Google Analytics för att förstå hur sajten används i aggregerad
              form. Analys-cookies aktiveras endast om du godkänner det via cookie-bannern.
              Inga personuppgifter säljs eller delas med tredje part. IP-adresser anonymiseras
              innan lagring.
            </p>
          </Section>

        </div>
      </main>
    </div>
  )
}
