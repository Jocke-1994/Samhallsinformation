import { useState } from 'react'

interface NastaSteg {
  typ: 'ersattare' | 'borttagning'
  datum: string
}

interface Subkalla {
  namn: string
  status: string
  dotColor: string
  kollad: string
  nastaKontroll: string | null
  paverkan: string
  nastaSteg?: NastaSteg
  kanalPaverkan?: string[]
}

interface Tjanst {
  namn: string
  status: string
  dotColor: string
  kollad: string
  nastaKontroll: string | null
  subkallor?: Subkalla[]
  paverkan?: string
  kanalPaverkan?: string[]
  beraknatIDrift?: string
}

interface PlaneratUnderhall {
  namn: string
  typ: 'Intern tjänst' | 'Extern källa'
  start: string
  beraknatSlut: string
  beskrivning: string
}

const TJANSTER: Tjanst[] = [
  {
    namn: 'API',
    status: 'Begränsad drift',
    dotColor: 'bg-amber-400',
    kollad: '2026-03-19 10:00',
    nastaKontroll: null,
    subkallor: [
      {
        namn: 'Regeringen.se', status: 'Svarar inte', dotColor: 'bg-red-800', kollad: '2026-03-19 10:00', nastaKontroll: '2026-03-19 20:00',
        paverkan: 'Nyheter från Regeringen.se visas inte i ditt flöde och notifieringar från denna källa uteblir tills tjänsten återgår till drift.',
        nastaSteg: { typ: 'ersattare', datum: '2026-03-24 00:00' },
        kanalPaverkan: ['E-post', 'SMS'],
      },
      {
        namn: 'SMHI', status: 'Nedlagd', dotColor: 'bg-slate-400', kollad: '2026-03-18 18:00', nastaKontroll: null,
        paverkan: 'SMHI är inte längre en aktiv källa. Väderrelaterade nyheter från SMHI visas inte.',
        nastaSteg: { typ: 'borttagning', datum: '2026-03-24 00:00' },
        kanalPaverkan: ['Alla kanaler'],
      },
      {
        namn: 'Riksdagen.se', status: 'Okänd', dotColor: 'bg-slate-300', kollad: '2026-03-19 06:00', nastaKontroll: null,
        paverkan: 'Det går inte att avgöra om Riksdagen.se fungerar. Nyheter härifrån kan vara inaktuella.',
        kanalPaverkan: ['E-post'],
      },
    ],
  },
  { namn: 'Datainsamling',  status: 'I drift',        dotColor: 'bg-green-500', kollad: '2026-03-19 09:45', nastaKontroll: null },
  {
    namn: 'Notifieringar', status: 'Begränsad drift', dotColor: 'bg-amber-400', kollad: '2026-03-19 09:45', nastaKontroll: null,
    paverkan: 'Vissa notifieringar kan fördröjas eller utebli. Vi arbetar på att lösa problemet.',
    kanalPaverkan: ['SMS'],
    beraknatIDrift: '2026-03-19 18:00',
  },
  { namn: 'Webbgränssnitt', status: 'I drift',        dotColor: 'bg-green-500', kollad: '2026-03-19 08:00', nastaKontroll: null },
  {
    namn: 'Autentisering', status: 'Underhåll', dotColor: 'bg-blue-400', kollad: '2026-03-19 07:00', nastaKontroll: '2026-03-19 22:00',
    paverkan: 'Inloggning kan vara otillgänglig under underhållet. Redan inloggade användare påverkas inte.',
    kanalPaverkan: ['Alla kanaler'],
    beraknatIDrift: '2026-03-19 22:00',
  },
]

const PLANERAT_UNDERHALL: PlaneratUnderhall[] = [
  {
    namn: 'Autentisering',
    typ: 'Intern tjänst',
    start: '2026-03-19 07:00',
    beraknatSlut: '2026-03-19 22:00',
    beskrivning: 'Planerat systemunderhåll. Inloggning kan vara otillgänglig under perioden.',
  },
  {
    namn: 'Regeringen.se',
    typ: 'Extern källa',
    start: '2026-03-19 10:00',
    beraknatSlut: '2026-03-24 00:00',
    beskrivning: 'Källan svarar inte. En ersättande källa aktiveras automatiskt vid återgång.',
  },
]

function InfoPanel({ paverkan, nastaSteg, kanalPaverkan, beraknatIDrift }: {
  paverkan: string
  nastaSteg?: NastaSteg
  kanalPaverkan?: string[]
  beraknatIDrift?: string
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-white px-4 py-3 flex gap-3">
        <span className="text-base shrink-0 mt-0.5">⚠️</span>
        <p className="text-xs text-slate-600 leading-relaxed">{paverkan}</p>
      </div>
      {beraknatIDrift && (
        <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex gap-3">
          <span className="text-base shrink-0 mt-0.5">🕐</span>
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Beräknat i drift</p>
            <p className="text-xs text-blue-600">{beraknatIDrift}</p>
          </div>
        </div>
      )}
      {nastaSteg && (
        <div className={`px-4 py-3 flex gap-3 border-t ${nastaSteg.typ === 'ersattare' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <span className="text-base shrink-0 mt-0.5">{nastaSteg.typ === 'ersattare' ? '🔄' : '🗑️'}</span>
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${nastaSteg.typ === 'ersattare' ? 'text-green-700' : 'text-red-700'}`}>
              {nastaSteg.typ === 'ersattare' ? 'Ny källa aktiveras' : 'Källan tas bort'}{' '}
              <span className="font-bold">{nastaSteg.datum}</span>
            </p>
            <p className={`text-xs leading-relaxed ${nastaSteg.typ === 'ersattare' ? 'text-green-600' : 'text-red-500'}`}>
              {nastaSteg.typ === 'ersattare'
                ? 'Du behöver inte göra någon åtgärd för att fortsatt få information.'
                : 'Källan planeras inte få en ersättare och kommer att tas bort automatiskt.'}
            </p>
          </div>
        </div>
      )}
      {kanalPaverkan && kanalPaverkan.length > 0 && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 flex gap-3">
          <span className="text-base shrink-0 mt-0.5">🔔</span>
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1.5">Påverkade notifieringskanaler</p>
            <div className="flex flex-wrap gap-1.5">
              {kanalPaverkan.map(k => (
                <span key={k} className="text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                  {k} fungerar inte
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SystemstatusKort() {
  const [expandedTjanst, setExpandedTjanst] = useState<string | null>(null)
  const [expandedKalla, setExpandedKalla] = useState<string | null>(null)
  const getPingDelay = () => `-${performance.now() % 1000}ms`

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden self-start">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 text-center">Systemstatus</h2>
        <p className="text-sm text-slate-400 mt-0.5 text-center">Aktuell driftstatus för alla tjänster</p>
      </div>

      {/* Tjänsterader */}
      <div className="flex flex-col divide-y divide-slate-100">
        {TJANSTER.map(tj => {
          const problematiska = tj.subkallor?.filter(s => s.status !== 'I drift') ?? []
          const harSubproblem = problematiska.length > 0
          const harEgenInfo = !harSubproblem && !!tj.paverkan
          const kanExpandera = harSubproblem || harEgenInfo
          const isExpanded = expandedTjanst === tj.namn

          return (
            <div key={tj.namn}>
              <button
                onClick={() => kanExpandera ? setExpandedTjanst(isExpanded ? null : tj.namn) : undefined}
                className={`w-full py-3 text-left transition-colors ${kanExpandera ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                style={{ display: 'grid', gridTemplateColumns: '160px 1fr 150px', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px' }}
              >
                <span className="text-sm text-slate-700 font-medium whitespace-nowrap">{tj.namn}</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 whitespace-nowrap">Senast kontrollerad {tj.kollad}</span>
                  {tj.nastaKontroll && (
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Ny kontroll sker: {tj.nastaKontroll}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="relative flex w-2.5 h-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tj.dotColor} opacity-60`} style={{ animationDelay: getPingDelay() }} />
                    <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${tj.dotColor}`} />
                  </span>
                  <span className="text-xs text-slate-600">{tj.status}</span>
                  {kanExpandera && (
                    <span className="text-slate-300 text-xs ml-1">{isExpanded ? '▴' : '▾'}</span>
                  )}
                </div>
              </button>

              {/* Eget infopanel (Notifieringar, Autentisering etc.) */}
              {isExpanded && harEgenInfo && (
                <div className="px-4 pb-3">
                  <InfoPanel
                    paverkan={tj.paverkan!}
                    kanalPaverkan={tj.kanalPaverkan}
                    beraknatIDrift={tj.beraknatIDrift}
                  />
                </div>
              )}

              {/* Subrader — externa källor med problem */}
              {isExpanded && harSubproblem && problematiska.map(s => (
                <div key={s.namn} className="border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setExpandedKalla(expandedKalla === s.namn ? null : s.namn)}
                    className="w-full py-2.5 text-left hover:bg-slate-100 transition-colors"
                    style={{ display: 'grid', gridTemplateColumns: '160px 1fr 150px', alignItems: 'center', paddingLeft: '28px', paddingRight: '16px' }}
                  >
                    <span className="text-sm text-slate-600 whitespace-nowrap">{s.namn}</span>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Senast kontrollerad {s.kollad}</span>
                      {s.nastaKontroll && (
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Ny kontroll sker: {s.nastaKontroll}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="relative flex w-2.5 h-2.5 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dotColor} opacity-60`} style={{ animationDelay: getPingDelay() }} />
                        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${s.dotColor}`} />
                      </span>
                      <span className="text-xs text-slate-500">{s.status}</span>
                      <span className="text-slate-300 text-xs ml-1">{expandedKalla === s.namn ? '▴' : '▾'}</span>
                    </div>
                  </button>
                  {expandedKalla === s.namn && (
                    <div className="px-4 pb-3">
                      <InfoPanel
                        paverkan={s.paverkan}
                        nastaSteg={s.nastaSteg}
                        kanalPaverkan={s.kanalPaverkan}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Planerat underhåll */}
      <div className="border-t border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 text-center">Planerat underhåll</h2>
          <p className="text-sm text-slate-400 mt-0.5 text-center">Kommande schemalagda underhållsfönster</p>
        </div>
        {PLANERAT_UNDERHALL.length === 0 ? (
          <div className="px-6 py-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-slate-600">Inga planerade underhåll</p>
            <p className="text-xs text-slate-400 mt-1">Vi meddelar här i god tid innan schemalagt underhåll.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {PLANERAT_UNDERHALL.map(u => (
              <div key={u.namn} className="px-6 py-4 flex flex-col gap-1.5">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-slate-800">{u.namn}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{u.beskrivning}</p>
                <div className="flex items-center gap-4 mt-0.5">
                  <span className="text-xs text-slate-400">Start: <span className="font-medium text-slate-600">{u.start}</span></span>
                  <span className="text-xs text-slate-400">Beräknat klart: <span className="font-medium text-slate-600">{u.beraknatSlut}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

type ArendeStatus = 'Öppet' | 'Under behandling' | 'Hanterat' | 'Stängt'
type SortField = 'status' | 'skapat' | 'uppdaterat' | null
type SortDir = 'asc' | 'desc'

interface Meddelande {
  fran: 'du' | 'support'
  text: string
  tid: string
}

interface Arende {
  id: string
  kategori: string
  amne: string
  status: ArendeStatus
  skapat: string
  uppdaterat: string
  meddelanden: Meddelande[]
}

const INITIAL_ARENDEN: Arende[] = [
  {
    id: 'SUP-0042',
    kategori: 'Notifieringar',
    amne: 'Får inte notiser från Polisen trots att det är inställt',
    status: 'Under behandling',
    skapat: '2026-03-15',
    uppdaterat: '2026-03-17',
    meddelanden: [
      { fran: 'du', text: 'Hej! Jag har ställt in notiser från Polisen under Notifieringar men får ändå ingenting. Har testat att logga ut och in utan resultat.', tid: '2026-03-15 09:14' },
      { fran: 'support', text: 'Hej! Tack för att du hör av dig. Vi har tagit emot ditt ärende och tittar på det. Kan du bekräfta vilken e-postadress du har registrerad?', tid: '2026-03-16 11:30' },
      { fran: 'du', text: 'Det är exempel@mail.se', tid: '2026-03-16 12:05' },
      { fran: 'support', text: 'Tack! Vi ser en konfigurationsavvikelse och jobbar på en lösning. Vi återkommer inom 24 timmar.', tid: '2026-03-17 09:00' },
    ],
  },
  {
    id: 'SUP-0038',
    kategori: 'Tekniskt fel',
    amne: 'Källknappen för SMHI visas inte i menyn',
    status: 'Öppet',
    skapat: '2026-03-10',
    uppdaterat: '2026-03-10',
    meddelanden: [
      { fran: 'du', text: 'SMHI-knappen i sidomenyn har försvunnit efter senaste uppdateringen. Kan inte navigera till SMHI-nyheter längre.', tid: '2026-03-10 14:22' },
    ],
  },
  {
    id: 'SUP-0031',
    kategori: 'Konto',
    amne: 'Vill ta bort mitt konto',
    status: 'Hanterat',
    skapat: '2026-03-01',
    uppdaterat: '2026-03-03',
    meddelanden: [
      { fran: 'du', text: 'Jag vill radera mitt konto och all min data enligt GDPR.', tid: '2026-03-01 10:00' },
      { fran: 'support', text: 'Hej! Vi har tagit emot din begäran. Ditt konto och all tillhörande data kommer att raderas inom 30 dagar enligt GDPR artikel 17.', tid: '2026-03-02 09:15' },
      { fran: 'support', text: 'Kontot är nu raderat. Ärendet stängs.', tid: '2026-03-03 11:00' },
    ],
  },
  {
    id: 'SUP-0028',
    kategori: 'GDPR & uppgifter',
    amne: 'Fråga om GDPR och vilken data som sparas',
    status: 'Stängt',
    skapat: '2026-02-20',
    uppdaterat: '2026-02-21',
    meddelanden: [
      { fran: 'du', text: 'Vilken data sparar ni om mig som användare?', tid: '2026-02-20 16:45' },
      { fran: 'support', text: 'Vi sparar: namn, e-postadress, dina valda källor och notifieringsinställningar. Ingen annan data. Du kan ladda ner allt under Konto → Exportera din data.', tid: '2026-02-21 10:20' },
    ],
  },
  {
    id: 'SUP-0019',
    kategori: 'Notifieringar',
    amne: 'Notifieringar skickas vid fel tidpunkt',
    status: 'Hanterat',
    skapat: '2026-02-10',
    uppdaterat: '2026-02-14',
    meddelanden: [
      { fran: 'du', text: 'Jag har ställt in daglig sammanfattning kl 07:00 men får den vid midnatt istället.', tid: '2026-02-10 08:30' },
      { fran: 'support', text: 'Tack för rapporten! Det var ett fel i tidszonshanteringen. Vi har åtgärdat det i version 0.3.1.', tid: '2026-02-14 14:00' },
    ],
  },
]

const STATUS_STYLES: Record<ArendeStatus, string> = {
  'Öppet':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Hanterat':             'bg-green-50 text-green-700 border border-green-200',
  'Stängt':           'bg-slate-100 text-slate-500 border border-slate-200',
}

const STATUS_ORDER: ArendeStatus[] = ['Öppet', 'Under behandling', 'Hanterat', 'Stängt']

const KATEGORIER = [
  'Notifieringar',
  'Inloggning',
  'GDPR & uppgifter',
  'Konto',
  'Tekniskt fel',
  'Annat',
]


type FaqKategori = 'Notifieringar' | 'Mina källor' | 'Konto' | 'Uppdateringar'

interface FaqItem {
  q: string
  a: string
  kategori: FaqKategori
}

const FAQ_ITEMS: FaqItem[] = [
  { kategori: 'Notifieringar', q: 'Varför fick jag ingen notis?', a: 'Kontrollera att rätt kanal (mail/SMS) är aktiverad under Notifieringar och att källan är tillagd under Mina källor. Det kan ta upp till 5 minuter innan en ny händelse når dig.' },
  { kategori: 'Notifieringar', q: 'Hur ändrar jag mitt SMS-nummer?', a: 'Gå till Notifieringar → Standardinställningar. Där visas ditt registrerade nummer och du kan uppdatera det.' },
  { kategori: 'Notifieringar', q: 'Kan jag pausa notiser tillfälligt?', a: 'Ja, avmarkera Mail och SMS i Standardinställningar under Notifieringar. Dina inställningar sparas och kan aktiveras igen när du vill.' },
  { kategori: 'Mina källor',   q: 'Hur lägger jag till fler källor?', a: 'Gå till Mina källor i profilmenyn. Där kan du söka efter myndigheter eller hämta förslag automatiskt via SPAR.' },
  { kategori: 'Mina källor',   q: 'Kan jag följa flera myndigheter samtidigt?', a: 'Ja, du kan lägga till hur många källor du vill. Alla visas i ditt nyhetsflöde och du kan välja vilka du vill få notiser från.' },
  { kategori: 'Konto',         q: 'Hur tar jag bort mitt konto?', a: 'Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras.' },
  { kategori: 'Konto',         q: 'Hur laddar jag ner min data?', a: 'Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20).' },
  { kategori: 'Uppdateringar', q: 'Hur ser jag vad som är nytt i senaste versionen?', a: 'Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar med direktlänkar till berörda funktioner.' },
  { kategori: 'Uppdateringar', q: 'Hur rapporterar jag ett fel?', a: 'Skapa ett nytt ärende via formuläret längre ner på den här sidan. Välj "Tekniskt fel på sidan" som ämne och beskriv vad som hänt.' },
]


const FAQ_KATEGORIER: FaqKategori[] = ['Notifieringar', 'Mina källor', 'Konto', 'Uppdateringar']

function FaqKort() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [aktivKategori, setAktivKategori] = useState<FaqKategori | 'alla'>('alla')

  const visade = FAQ_ITEMS.filter(item => aktivKategori === 'alla' || item.kategori === aktivKategori)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 text-center">Vanliga frågor</h2>
        <p className="text-sm text-slate-400 mt-0.5 text-center">Snabbsvar på de vanligaste frågorna</p>
      </div>

      {/* Filterflikar */}
      <div className="flex border-b border-slate-100">
        {(['alla', ...FAQ_KATEGORIER] as (FaqKategori | 'alla')[]).map(kat => {
          const count = kat === 'alla' ? FAQ_ITEMS.length : FAQ_ITEMS.filter(i => i.kategori === kat).length
          const isActive = aktivKategori === kat
          const activeStyles: Record<string, string> = {
            'alla':          'bg-violet-600 text-white',
            'Notifieringar': 'bg-blue-500 text-white',
            'Mina källor':   'bg-violet-500 text-white',
            'Konto':         'bg-indigo-500 text-white',
            'Uppdateringar': 'bg-emerald-500 text-white',
          }
          return (
            <button
              key={kat}
              onClick={() => { setAktivKategori(kat); setOpenIndex(null) }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? activeStyles[kat]
                  : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="block">{kat === 'alla' ? 'Alla' : kat}</span>
              <span className="block text-[11px] mt-0.5 opacity-80">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-slate-100">
        {visade.map((item, i) => (
          <div key={`${aktivKategori}-${i}`}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-start justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors gap-4"
            >
              <span className="text-sm font-medium text-slate-700">{item.q}</span>
              <span className="text-slate-400 shrink-0">{openIndex === i ? '−' : '+'}</span>
            </button>
            {openIndex === i && (
              <div className="px-6 pb-4">
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-8 flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-4xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function SortIcon({ field: _field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-violet-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function ArendeRad({
  arende,
  expanded,
  pinned,
  onToggle,
  onTogglePin,
}: {
  arende: Arende
  expanded: boolean
  pinned: boolean
  onToggle: () => void
  onTogglePin: (e: React.MouseEvent) => void
}) {
  const [svar, setSvar] = useState('')
  const [skickat, setSkickat] = useState(false)
  const kanSvara = arende.status === 'Öppet' || arende.status === 'Under behandling'

  return (
    <>
      <tr onClick={onToggle} className="hover:bg-slate-50 transition-colors cursor-pointer">
        <td className="pl-4 py-4 text-center" onClick={e => e.stopPropagation()}>
          <button
            onClick={onTogglePin}
            className="text-lg leading-none transition-colors"
            title={pinned ? 'Ta bort fästning' : 'Fäst överst'}
          >
            {pinned ? (
              <span className="text-amber-400">★</span>
            ) : (
              <span className="text-slate-300 hover:text-amber-300">☆</span>
            )}
          </button>
        </td>
        <td className="pl-4 pr-8 py-4 font-mono text-xs text-slate-400">{arende.id}</td>
        <td className="px-4 py-4">
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mb-1 inline-block">{arende.kategori}</span>
          <p className="text-slate-700 font-medium">{arende.amne}</p>
        </td>
        <td className="px-4 py-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[arende.status]}`}>
            {arende.status}
          </span>
        </td>
        <td className="px-4 py-4 text-slate-400 text-xs">{arende.skapat}</td>
        <td className="pl-6 pr-4 py-4 text-slate-400 text-xs">{arende.uppdaterat}</td>
        <td className="pr-4 py-4 text-slate-400 text-xs text-right">
          <span className={`transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50 border-t border-b border-slate-200 p-0">
            <div className="px-8 py-6 flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Historik</p>
                {arende.meddelanden.map((m, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 max-w-2xl ${m.fran === 'du' ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
                      m.fran === 'du'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                    }`}>
                      {m.text}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {m.fran === 'du' ? 'Du' : 'Support'} · {m.tid}
                    </p>
                  </div>
                ))}
              </div>

              {kanSvara && (
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Svara</p>
                  {skickat ? (
                    <p className="text-sm text-green-600">Ditt svar har skickats.</p>
                  ) : (
                    <>
                      <textarea
                        value={svar}
                        onChange={e => setSvar(e.target.value)}
                        rows={3}
                        placeholder="Skriv ditt svar..."
                        className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400 resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { if (svar.trim()) setSkickat(true) }}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Skicka svar
                        </button>
                        <button className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm rounded-lg transition-colors">
                          Stäng ärende
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!kanSvara && (
                <p className="text-xs text-slate-400 border-t border-slate-200 pt-4">
                  Det här ärendet är {arende.status.toLowerCase()} och kan inte längre besvaras.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Support() {
  const [arenden, setArenden] = useState<Arende[]>(INITIAL_ARENDEN)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [kategori, setKategori] = useState('')
  const [amne, setAmne] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [skickat, setSkickat] = useState(false)
  const [nyttId, setNyttId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const totalt   = arenden.length
  const oppna    = arenden.filter(a => a.status === 'Öppet').length
  const underBeh = arenden.filter(a => a.status === 'Under behandling').length
  const losta    = arenden.filter(a => a.status === 'Hanterat').length

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function togglePin(id: string) {
    setPinnedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function generateId(): string {
    const nums = arenden.map(a => parseInt(a.id.split('-')[1]))
    const max = Math.max(...nums)
    return `SUP-${String(max + 1).padStart(4, '0')}`
  }

  function handleSkicka() {
    if (!kategori)                     { setError('Välj en kategori.'); return }
    if (!amne.trim())                  { setError('Ange ett ämne.'); return }
    if (meddelande.trim().length < 10) { setError('Beskriv ditt ärende lite mer.'); return }
    const id = generateId()
    const today = new Date().toISOString().split('T')[0]
    const tid = new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    const nyttArende: Arende = {
      id,
      kategori,
      amne: amne.trim(),
      status: 'Öppet',
      skapat: today,
      uppdaterat: today,
      meddelanden: [{ fran: 'du', text: meddelande, tid }],
    }
    setArenden(prev => [nyttArende, ...prev])
    setNyttId(id)
    setSkickat(true)
    setKategori('')
    setAmne('')
    setMeddelande('')
    setError('')
  }

  const sorted = [...arenden].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id)
    const bPinned = pinnedIds.has(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    if (!sortField) return 0
    let cmp = 0
    if (sortField === 'status')      cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    if (sortField === 'skapat')      cmp = a.skapat.localeCompare(b.skapat)
    if (sortField === 'uppdaterat')  cmp = a.uppdaterat.localeCompare(b.uppdaterat)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const thClass = "py-3 text-xs font-medium text-slate-500 uppercase tracking-wide select-none"

  return (
    <div className="flex flex-col gap-8 mt-6">

      {/* Statistik + Skicka ärende + Ärendetabell i samma grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Totalt"           value={totalt}   color="text-slate-900" />
        <StatCard label="Öppna"            value={oppna}    color="text-blue-600"  />
        <StatCard label="Under behandling" value={underBeh} color="text-amber-600" />
        <StatCard label="Lösta"            value={losta}    color="text-green-600" />
      </div>

      {/* Skicka ärende + Ärendetabell */}
      <div className="grid grid-cols-4 gap-4">

      {/* Skicka nytt ärende */}
      <div className="col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden self-start">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Skicka nytt ärende</h2>
          <p className="text-sm text-slate-400 mt-0.5">Vi svarar inom 1–3 vardagar</p>
        </div>
        <div className="px-6 pt-6 pb-0 flex flex-col gap-5">
          {skickat && nyttId && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              Ditt ärende har skickats och tilldelats nummer <span className="font-mono font-semibold">{nyttId}</span>. Vi återkommer inom 1–3 vardagar.
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Kategori</label>
            <select
              value={kategori}
              onChange={e => { setKategori(e.target.value); setSkickat(false); setError('') }}
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Välj kategori...</option>
              {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Ämne</label>
            <input
              type="text"
              value={amne}
              onChange={e => { setAmne(e.target.value); setSkickat(false); setError('') }}
              placeholder="Beskriv kortfattat vad det gäller..."
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Beskriv ditt ärende</label>
            <textarea
              value={meddelande}
              onChange={e => { setMeddelande(e.target.value); setSkickat(false); setError('') }}
              rows={5}
              placeholder="Berätta vad som hänt eller vad du behöver hjälp med..."
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex justify-center py-5">
          <button
            onClick={handleSkicka}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Skicka ärende
          </button>
        </div>
      </div>

      {/* Ärendetabell */}
      <div className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Mina ärenden</h2>
          <p className="text-sm text-slate-400 mt-0.5">Klicka på ett ärende för att se historik och svara</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="pl-4 w-10" />
                <th className={`pl-4 pr-8 w-32 ${thClass}`}>Ärende-ID</th>
                <th className={`px-4 ${thClass}`}>Ämne</th>
                <th
                  className={`px-4 w-40 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon field="status" active={sortField === 'status'} dir={sortDir} />
                </th>
                <th
                  className={`px-4 w-28 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('skapat')}
                >
                  Skapat <SortIcon field="skapat" active={sortField === 'skapat'} dir={sortDir} />
                </th>
                <th
                  className={`pl-6 pr-4 w-40 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('uppdaterat')}
                >
                  Senast uppdaterat <SortIcon field="uppdaterat" active={sortField === 'uppdaterat'} dir={sortDir} />
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(a => (
                <ArendeRad
                  key={a.id}
                  arende={a}
                  expanded={expandedId === a.id}
                  pinned={pinnedIds.has(a.id)}
                  onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  onTogglePin={e => { e.stopPropagation(); togglePin(a.id) }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* Systemstatus + FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemstatusKort />
        <FaqKort />
      </div>

    </div>
  )
}
