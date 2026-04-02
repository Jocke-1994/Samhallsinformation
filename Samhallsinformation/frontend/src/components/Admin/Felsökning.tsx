import { useState } from 'react'

type Hälsa = 'OK' | 'Varning' | 'Nere' | 'Kontrollerar...'

interface Tjänst {
  id:          string
  namn:        string
  beskrivning: string
  hälsa:       Hälsa
  svarstid:    string
  senast:      string
}

type FärskhetStatus = 'OK' | 'Försenad' | 'Kritisk'

interface KällKontroll {
  id:              number
  namn:            string
  url:             string
  hälsa:           Hälsa
  aktiv:           boolean
  mock:            boolean
  senast:          string
  senastArtikel:   string   // tidsstämpel för senaste inlästa artikel
  förväntadFrekvens: string // t.ex. "< 2 h"
  färskhetStatus:  FärskhetStatus
}

interface Felrad {
  tid:    string
  tjänst: string
  nivå:   'Fel' | 'Varning' | 'Info'
  meddelande: string
}

const INITIAL_TJÄNSTER: Tjänst[] = [
  { id: 'api',      namn: 'Backend-API',  beskrivning: 'REST-API på port 5000',        hälsa: 'OK',      svarstid: '42 ms',  senast: '10:55:01' },
  { id: 'db',       namn: 'Databas',      beskrivning: 'SQLite / EF Core',             hälsa: 'OK',      svarstid: '8 ms',   senast: '10:55:01' },
  { id: 'ingestor', namn: 'Ingestor',     beskrivning: 'Bakgrundstjänst — 5 min-cykel',hälsa: 'OK',      svarstid: '—',      senast: '10:50:00' },
  { id: 'notis',    namn: 'Notifieringar',beskrivning: 'Utskickstjänst e-post / SMS',  hälsa: 'Varning', svarstid: '—',      senast: '10:30:00' },
]

const INITIAL_KÄLLOR: KällKontroll[] = [
  { id: 1, namn: 'Polisen',         url: 'https://polisen.se/aktuellt/rss',           hälsa: 'OK',      aktiv: true,  mock: false, senast: '10:50', senastArtikel: '14:23',  förväntadFrekvens: '< 2 h',  färskhetStatus: 'Kritisk'  },
  { id: 2, namn: 'SMHI',            url: 'https://smhi.se/vader/varningar/rss',        hälsa: 'Varning', aktiv: true,  mock: false, senast: '10:50', senastArtikel: '10:11',  förväntadFrekvens: '< 6 h',  färskhetStatus: 'OK'       },
  { id: 3, namn: 'MSB',             url: 'https://msb.se/sv/om-msb/nyheter/rss',       hälsa: 'OK',      aktiv: true,  mock: false, senast: '10:50', senastArtikel: '09:45',  förväntadFrekvens: '< 12 h', färskhetStatus: 'OK'       },
  { id: 4, namn: 'Trafikverket',    url: 'https://api.trafikinfo.trafikverket.se',      hälsa: 'Nere',    aktiv: true,  mock: true,  senast: '10:50', senastArtikel: '09:15',  förväntadFrekvens: '< 2 h',  färskhetStatus: 'Försenad' },
  { id: 5, namn: 'Krisinformation', url: 'https://krisinformation.se/rss',             hälsa: 'OK',      aktiv: true,  mock: false, senast: '10:50', senastArtikel: '08:30',  förväntadFrekvens: '< 24 h', färskhetStatus: 'OK'       },
  { id: 6, namn: 'Gbg Stad',        url: 'https://goteborg.se/rss',                   hälsa: 'OK',      aktiv: false, mock: false, senast: '10:50', senastArtikel: '—',       förväntadFrekvens: '< 24 h', färskhetStatus: 'OK'       },
  { id: 7, namn: 'Lst VGR',         url: 'https://lansstyrelsen.se/vgr/rss',           hälsa: 'OK',      aktiv: false, mock: false, senast: '10:50', senastArtikel: '—',       förväntadFrekvens: '< 24 h', färskhetStatus: 'OK'       },
  { id: 8, namn: 'VGR',             url: 'https://vgregion.se/rss',                   hälsa: 'OK',      aktiv: false, mock: false, senast: '10:50', senastArtikel: '—',       förväntadFrekvens: '< 24 h', färskhetStatus: 'OK'       },
]

type KontrollTyp = 'Ingestor' | 'Fullständigt flödestest' | 'Event-drivet' | 'Intern'
type KontrollKategori = 'Källa' | 'Intern'
type KontrollStatus = 'Schemalagd' | 'Köad' | 'Pågår'

interface KommandeKontroll {
  id:          number
  typ:         KontrollTyp
  kategori:    KontrollKategori
  beskrivning: string
  tid:         string
  om:          string
  status:      KontrollStatus
}

const KOMMANDE: KommandeKontroll[] = [
  { id: 1, typ: 'Event-drivet',            kategori: 'Källa',  beskrivning: 'Polisen — datafärskhetslarm',          tid: '19:07', om: 'om 1 min',      status: 'Köad'       },
  { id: 2, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Retry-kö — misslyckade operationer',    tid: '19:08', om: 'om 2 min',      status: 'Schemalagd' },
  { id: 3, typ: 'Event-drivet',            kategori: 'Källa',  beskrivning: 'Trafikverket — datafärskhetslarm',      tid: '19:09', om: 'om 3 min',      status: 'Köad'       },
  { id: 4, typ: 'Ingestor',               kategori: 'Källa',  beskrivning: 'Alla aktiva källor',                    tid: '19:10', om: 'om 4 min',      status: 'Schemalagd' },
  { id: 5, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Notis-verifiering — utskickskontroll',  tid: '19:16', om: 'om 10 min',     status: 'Schemalagd' },
  { id: 6, typ: 'Fullständigt flödestest', kategori: 'Källa',  beskrivning: 'Alla aktiva källor',                    tid: '04:00', om: 'om 8 h 53 min', status: 'Schemalagd' },
  { id: 7, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Sessionsrensning',                      tid: '04:00', om: 'om 8 h 53 min', status: 'Schemalagd' },
  { id: 8, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Databaskontroll — integritetskoll',     tid: '04:05', om: 'om 8 h 58 min', status: 'Schemalagd' },
]

const TYP_CLS: Record<KontrollTyp, string> = {
  'Ingestor':               'bg-violet-100 text-violet-700 border border-violet-200',
  'Fullständigt flödestest':'bg-sky-100 text-sky-700 border border-sky-200',
  'Event-drivet':           'bg-amber-100 text-amber-700 border border-amber-200',
  'Intern':                 'bg-slate-100 text-slate-600 border border-slate-200',
}

const STATUS_CLS: Record<KontrollStatus, string> = {
  'Schemalagd': 'text-slate-400',
  'Köad':       'text-amber-600 font-medium',
  'Pågår':      'text-violet-600 font-medium',
}

const KATEGORI_FILTER: KontrollKategori[] = ['Källa', 'Intern']

function KommandeKontroller() {
  const [filter, setFilter] = useState<KontrollKategori | 'Alla'>('Alla')

  const visade = filter === 'Alla' ? KOMMANDE : KOMMANDE.filter(k => k.kategori === filter)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Kommande kontroller</h3>
          <p className="text-xs text-slate-400 mt-0.5">Schemalagda och köade körningar</p>
        </div>
        <div className="flex gap-1">
          {(['Alla', ...KATEGORI_FILTER] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filter === f
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {visade.map(k => (
          <div key={k.id} className="flex items-center gap-4 px-6 py-3">
            <div className="w-24 shrink-0 text-right">
              <p className="text-sm font-mono text-slate-700">{k.tid}</p>
              <p className="text-xs text-slate-400">{k.om}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${TYP_CLS[k.typ]}`}>
              {k.typ}
            </span>
            <p className="flex-1 text-sm text-slate-600">{k.beskrivning}</p>
            <span className={`text-xs shrink-0 ${STATUS_CLS[k.status]}`}>{k.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FELLOGGAR: Felrad[] = [
  { tid: '10:30:11', tjänst: 'Notifieringar', nivå: 'Varning', meddelande: 'SMS-utskick till +46701234567 fick inget svar — retry 1/3' },
  { tid: '09:15:44', tjänst: 'Ingestor',      nivå: 'Varning', meddelande: 'Trafikverket svarade inte inom 10 s — källa markerad som Nere' },
  { tid: '09:15:44', tjänst: 'Ingestor',      nivå: 'Info',    meddelande: 'Trafikverket: automatisk retry schemalagd om 5 min' },
  { tid: '08:02:03', tjänst: 'Backend-API',   nivå: 'Fel',     meddelande: 'Oväntad exception i EventsController.GetById — NullReferenceException' },
  { tid: '07:00:00', tjänst: 'Ingestor',      nivå: 'Info',    meddelande: 'Schemalagd insamling slutförd — 847 händelser inlästa, 12 dubbletter ignorerade' },
]

const FÄRSKHET_CLS: Record<FärskhetStatus, string> = {
  'OK':       'text-green-600',
  'Försenad': 'text-amber-600',
  'Kritisk':  'text-red-600 font-semibold',
}

const HÄLSA_CLS: Record<Hälsa, { pill: string; dot: string }> = {
  'OK':              { pill: 'bg-green-100 text-green-700 border border-green-200',  dot: 'bg-green-500' },
  'Varning':         { pill: 'bg-amber-100 text-amber-700 border border-amber-200',  dot: 'bg-amber-400' },
  'Nere':            { pill: 'bg-red-100 text-red-700 border border-red-200',        dot: 'bg-red-500'   },
  'Kontrollerar...': { pill: 'bg-slate-100 text-slate-500 border border-slate-200',  dot: 'bg-slate-400 animate-pulse' },
}

const NIVÅ_CLS: Record<Felrad['nivå'], string> = {
  'Fel':     'bg-red-100 text-red-700 border border-red-200',
  'Varning': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Info':    'bg-slate-100 text-slate-500 border border-slate-200',
}

type StegStatus = 'väntar' | 'kör' | 'OK' | 'Varning' | 'Fel'

interface PipelineSteg {
  namn:    string
  status:  StegStatus
  detalj?: string
}

const STEG_IKON: Record<StegStatus, string> = {
  'väntar':  '○',
  'kör':     '◌',
  'OK':      '✓',
  'Varning': '⚠',
  'Fel':     '✕',
}

const STEG_CLS: Record<StegStatus, string> = {
  'väntar':  'text-slate-300',
  'kör':     'text-violet-500 animate-pulse',
  'OK':      'text-green-600',
  'Varning': 'text-amber-500',
  'Fel':     'text-red-500',
}

interface HistorikRad {
  id:          number
  typ:         KontrollTyp
  beskrivning: string
  tid:         string
  resultat:    'OK' | 'Varning' | 'Fel'
  varaktighet: string
}

const HISTORIK: HistorikRad[] = [
  { id: 1, typ: 'Fullständigt flödestest', beskrivning: 'Alla aktiva källor',          tid: '04:00', resultat: 'Varning', varaktighet: '1 min 12 s' },
  { id: 2, typ: 'Event-drivet',            beskrivning: 'Trafikverket',                 tid: '09:16', resultat: 'Fel',     varaktighet: '10 s'       },
  { id: 3, typ: 'Event-drivet',            beskrivning: 'Polisen',                      tid: '14:24', resultat: 'OK',      varaktighet: '8 s'        },
  { id: 4, typ: 'Ingestor',               beskrivning: 'Alla aktiva källor',            tid: '18:50', resultat: 'OK',      varaktighet: '23 s'       },
  { id: 5, typ: 'Intern',                  beskrivning: 'Retry-kö — 1 operation omköad',tid: '18:53', resultat: 'OK',      varaktighet: '2 s'        },
]

const RESULTAT_CLS: Record<HistorikRad['resultat'], string> = {
  'OK':      'bg-green-100 text-green-700 border border-green-200',
  'Varning': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Fel':     'bg-red-100 text-red-700 border border-red-200',
}

function simuleraPing(
  setHälsa: (h: Hälsa) => void,
  resultat: Hälsa,
  svarstid?: (ms: string) => void,
) {
  setHälsa('Kontrollerar...')
  setTimeout(() => {
    setHälsa(resultat)
    if (svarstid) svarstid(`${Math.floor(Math.random() * 80 + 10)} ms`)
  }, 1200)
}

export default function Felsökning() {
  const [tjänster, setTjänster] = useState<Tjänst[]>(INITIAL_TJÄNSTER)
  const [källor, setKällor] = useState<KällKontroll[]>(INITIAL_KÄLLOR)
  const [testar, setTestar] = useState<number | null>(null)
  const [pipeline, setPipeline] = useState<Record<number, PipelineSteg[]>>({})
  const [kör, setKör] = useState<number | null>(null)
  const [loggFilter, setLoggFilter] = useState<Felrad['nivå'] | 'Alla'>('Alla')

  function pingTjänst(id: string) {
    setTjänster(prev => prev.map(t => t.id === id ? { ...t, hälsa: 'Kontrollerar...' } : t))
    setTimeout(() => {
      setTjänster(prev => prev.map(t => {
        if (t.id !== id) return t
        const ms = Math.floor(Math.random() * 80 + 10)
        return { ...t, hälsa: 'OK', svarstid: `${ms} ms`, senast: new Date().toLocaleTimeString('sv-SE') }
      }))
    }, 1200)
  }

  function pingAlla() {
    setTjänster(prev => prev.map(t => ({ ...t, hälsa: 'Kontrollerar...' })))
    setTimeout(() => {
      setTjänster(prev => prev.map(t => {
        const ms = Math.floor(Math.random() * 80 + 10)
        return { ...t, hälsa: 'OK', svarstid: t.id === 'ingestor' || t.id === 'notis' ? '—' : `${ms} ms`, senast: new Date().toLocaleTimeString('sv-SE') }
      }))
    }, 1400)
  }

  function toggleAktiv(id: number) {
    setKällor(prev => prev.map(k => k.id === id ? { ...k, aktiv: !k.aktiv } : k))
  }

  function toggleMock(id: number) {
    setKällor(prev => prev.map(k => k.id === id ? { ...k, mock: !k.mock } : k))
  }

  function körNu(id: number) {
    setKör(id)
    setTimeout(() => setKör(null), 2000)
  }

  function testaAnslutning(k: KällKontroll) {
    setTestar(k.id)

    const steg: PipelineSteg[] = [
      { namn: 'Anslutning',           status: 'väntar' },
      { namn: 'RSS/XML-parsing',      status: 'väntar' },
      { namn: 'Mappning → CanonicalEvent', status: 'väntar' },
      { namn: 'Deduplicering',        status: 'väntar' },
      { namn: 'Databas-skrivning',    status: 'väntar' },
    ]
    setPipeline(prev => ({ ...prev, [k.id]: steg }))

    const uppdatera = (index: number, status: StegStatus, detalj?: string) => {
      setPipeline(prev => ({
        ...prev,
        [k.id]: prev[k.id].map((s, i) => i === index ? { ...s, status, detalj } : s),
      }))
    }

    const ms = Math.floor(Math.random() * 200 + 50)
    const poster = Math.floor(Math.random() * 30 + 5)
    const nya = poster - Math.floor(Math.random() * 3)

    if (k.hälsa === 'Nere') {
      setTimeout(() => { uppdatera(0, 'kör') }, 300)
      setTimeout(() => { uppdatera(0, 'Fel', `Timeout efter 10 000 ms — ingen respons`); setTestar(null) }, 1500)
      return
    }

    setTimeout(() => { uppdatera(0, 'kör') }, 200)
    setTimeout(() => {
      uppdatera(0, k.hälsa === 'Varning' ? 'Varning' : 'OK', `HTTP 200 på ${ms} ms`)
      uppdatera(1, 'kör')
    }, 700)
    setTimeout(() => {
      uppdatera(1, k.hälsa === 'Varning' ? 'Varning' : 'OK',
        k.hälsa === 'Varning' ? `Content-Type text/html — förväntat application/xml` : `${poster} poster hittade`)
      if (k.hälsa !== 'Varning') uppdatera(2, 'kör')
    }, 1200)
    setTimeout(() => {
      if (k.hälsa === 'Varning') { setTestar(null); return }
      uppdatera(2, 'OK', `${poster}/${poster} mappade korrekt`)
      uppdatera(3, 'kör')
    }, 1700)
    setTimeout(() => {
      if (k.hälsa === 'Varning') return
      uppdatera(3, 'OK', `${poster - nya} dubbletter ignorerade`)
      uppdatera(4, 'kör')
    }, 2100)
    setTimeout(() => {
      if (k.hälsa === 'Varning') return
      uppdatera(4, 'OK', `${nya} nya events sparade`)
      setTestar(null)
    }, 2500)
  }

  const systemOK = tjänster.every(t => t.hälsa === 'OK')
  const systemVarning = !systemOK && tjänster.every(t => t.hälsa !== 'Nere')

  return (
    <div className="flex flex-col gap-6">

      {/* Systemhälsa */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Systemhälsa</h3>
            <p className="text-xs text-slate-400 mt-0.5">Status per tjänst — klicka för att pinga</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${systemOK ? 'bg-green-100 text-green-700 border-green-200' : systemVarning ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
              <span className={`w-2 h-2 rounded-full ${systemOK ? 'bg-green-500' : systemVarning ? 'bg-amber-400' : 'bg-red-500'}`} />
              {systemOK ? 'Alla system OK' : systemVarning ? 'Varningar finns' : 'Driftstörning'}
            </div>
            <button
              onClick={pingAlla}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Pinga alla
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {tjänster.map(t => {
            const cls = HÄLSA_CLS[t.hälsa]
            return (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cls.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.namn}</p>
                  <p className="text-xs text-slate-400">{t.beskrivning}</p>
                </div>
                <span className="text-xs text-slate-400 w-24 text-right">{t.svarstid}</span>
                <span className="text-xs text-slate-400 w-20 text-right">kl {t.senast}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border w-32 text-center ${cls.pill}`}>{t.hälsa}</span>
                <button
                  onClick={() => pingTjänst(t.id)}
                  disabled={t.hälsa === 'Kontrollerar...'}
                  className="text-xs font-medium text-slate-500 hover:text-violet-600 border border-slate-200 hover:border-violet-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  Pinga
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Källkontroller */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Källkontroller</h3>
          <p className="text-xs text-slate-400 mt-0.5">Aktivera/inaktivera, mockläge och manuell insamling per källa</p>
        </div>

        <div className="divide-y divide-slate-50">
          {källor.map(k => {
            const cls = HÄLSA_CLS[k.hälsa]
            const pågår = testar === k.id
            return (
              <div key={k.id} className="px-6 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cls.dot}`} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{k.namn}</p>
                    <p className="text-xs text-slate-400 truncate">{k.url}</p>
                  </div>

                  {/* Datafärskhets */}
                  <div className="text-right shrink-0 w-40">
                    <p className="text-xs text-slate-400">Senaste artikel</p>
                    <p className={`text-xs ${FÄRSKHET_CLS[k.färskhetStatus]}`}>
                      {k.senastArtikel === '—' ? '—' : `kl ${k.senastArtikel}`}
                      {k.färskhetStatus !== 'OK' && k.senastArtikel !== '—' && (
                        <span className="ml-1">⚠</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-300">förväntat {k.förväntadFrekvens}</p>
                  </div>

                  {/* Mock-toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">Mock</span>
                    <button
                      onClick={() => toggleMock(k.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${k.mock ? 'bg-amber-400' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${k.mock ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Aktiv-toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">Aktiv</span>
                    <button
                      onClick={() => toggleAktiv(k.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${k.aktiv ? 'bg-green-500' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${k.aktiv ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Kör nu */}
                  <button
                    onClick={() => körNu(k.id)}
                    disabled={kör === k.id || !k.aktiv}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 border-slate-200 text-slate-600 hover:border-violet-200 hover:text-violet-600 hover:bg-violet-50"
                  >
                    {kör === k.id ? 'Kör...' : 'Kör nu'}
                  </button>

                  {/* Testa anslutning */}
                  <button
                    onClick={() => testaAnslutning(k)}
                    disabled={pågår}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 hover:bg-sky-50"
                  >
                    {pågår ? 'Testar...' : 'Testa'}
                  </button>
                </div>

                {/* Pipeline-trace */}
                {pipeline[k.id] && (
                  <div className="ml-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                    {pipeline[k.id].map((steg, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className={`text-xs font-bold w-4 shrink-0 ${STEG_CLS[steg.status]}`}>
                          {STEG_IKON[steg.status]}
                        </span>
                        <span className="text-xs text-slate-600 w-44 shrink-0">{steg.namn}</span>
                        {steg.detalj && (
                          <span className={`text-xs ${steg.status === 'Fel' ? 'text-red-500' : steg.status === 'Varning' ? 'text-amber-500' : 'text-slate-400'}`}>
                            {steg.detalj}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Kommande kontroller */}
      <KommandeKontroller />

      {/* Kontrollhistorik */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Kontrollhistorik</h3>
          <p className="text-xs text-slate-400 mt-0.5">Senast genomförda kontroller</p>
        </div>
        <div className="divide-y divide-slate-50">
          {HISTORIK.map(h => (
            <div key={h.id} className="flex items-center gap-4 px-6 py-3">
              <span className="text-xs text-slate-400 font-mono w-12 shrink-0">{h.tid}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${TYP_CLS[h.typ]}`}>
                {h.typ}
              </span>
              <p className="flex-1 text-sm text-slate-600">{h.beskrivning}</p>
              <span className="text-xs text-slate-400 shrink-0">{h.varaktighet}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${RESULTAT_CLS[h.resultat]}`}>
                {h.resultat}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Felloggar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Felloggar</h3>
            <p className="text-xs text-slate-400 mt-0.5">Senaste 24 timmarna</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['Alla', 'Fel', 'Varning', 'Info'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setLoggFilter(n)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                    loggFilter === n ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button className="text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              Exportera
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {FELLOGGAR.filter(f => loggFilter === 'Alla' || f.nivå === loggFilter).map((f, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3">
              <span className="text-xs text-slate-400 font-mono w-20 shrink-0 pt-0.5">{f.tid}</span>
              <span className="text-xs font-medium text-slate-500 w-28 shrink-0 pt-0.5">{f.tjänst}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${NIVÅ_CLS[f.nivå]}`}>{f.nivå}</span>
              <p className="text-sm text-slate-700">{f.meddelande}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
