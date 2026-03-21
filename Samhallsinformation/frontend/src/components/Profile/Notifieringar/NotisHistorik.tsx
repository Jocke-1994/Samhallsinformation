import { useState, useRef, useEffect } from 'react'

type Kanal = 'epost' | 'sms' | 'push'
type Filter = 'alla' | Kanal

interface Leverans {
  kanal:     Kanal
  kontakt:   string
  smeknamn:  string
}

interface Notis {
  id:         number
  tid:        string
  kalla:      string
  rubrik:     string
  leveranser: Leverans[]
}

const KANAL_IKON:  Record<Kanal, string> = { epost: '📧', sms: '📱', push: '🔔' }
const KANAL_NAMN:  Record<Kanal, string> = { epost: 'E-post', sms: 'SMS', push: 'Push' }

const PER_SIDA = 8

const MOCK: Notis[] = [
  {
    id: 1, tid: '2026-03-21 08:14', kalla: 'Polisen', rubrik: 'Trafikolycka på E6 vid Göteborg',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se',      smeknamn: 'Mig'    },
      { kanal: 'epost', kontakt: 'mamma@gmail.com',   smeknamn: 'Mamma'  },
      { kanal: 'epost', kontakt: 'jobb@foretag.se',   smeknamn: 'Jobbet' },
      { kanal: 'epost', kontakt: 'backup@mail.com',   smeknamn: ''       },
      { kanal: 'epost', kontakt: 'extra@mail.com',    smeknamn: ''       },
      { kanal: 'sms',   kontakt: '073-XXX XX XX',     smeknamn: 'Mig'    },
      { kanal: 'sms',   kontakt: '070-XXX XX XX',     smeknamn: 'Mamma'  },
      { kanal: 'sms',   kontakt: '076-XXX XX XX',     smeknamn: 'Mormor' },
      { kanal: 'sms',   kontakt: '072-XXX XX XX',     smeknamn: ''       },
      { kanal: 'sms',   kontakt: '079-XXX XX XX',     smeknamn: ''       },
      { kanal: 'push',  kontakt: 'iPhone',             smeknamn: ''       },
      { kanal: 'push',  kontakt: 'iPad',               smeknamn: ''       },
      { kanal: 'push',  kontakt: 'MacBook',            smeknamn: ''       },
    ],
  },
  {
    id: 2, tid: '2026-03-20 19:02', kalla: 'SMHI', rubrik: 'Klass 1-varning för snö i Norrland',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 3, tid: '2026-03-20 12:30', kalla: 'MSB', rubrik: 'Viktigt meddelande till allmänheten',
    leveranser: [
      { kanal: 'push', kontakt: 'iPhone', smeknamn: '' },
      { kanal: 'sms',  kontakt: '073-XXX XX XX', smeknamn: 'Mamma' },
    ],
  },
  {
    id: 4, tid: '2026-03-20 09:45', kalla: 'Trafikverket', rubrik: 'Planerat vägarbete på riksväg 40',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 5, tid: '2026-03-19 16:20', kalla: 'Polisen', rubrik: 'Inbrott rapporterat i Majorna',
    leveranser: [{ kanal: 'sms', kontakt: '076-XXX XX XX', smeknamn: 'Mormor' }],
  },
  {
    id: 6, tid: '2026-03-19 11:05', kalla: 'SMHI', rubrik: 'Gult vädervarning — hård vind',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' },
      { kanal: 'push',  kontakt: 'iPhone',        smeknamn: ''    },
    ],
  },
  {
    id: 7, tid: '2026-03-18 14:10', kalla: 'Polisen', rubrik: 'Demonstration i centrala Göteborg',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 8, tid: '2026-03-18 08:00', kalla: 'MSB', rubrik: 'Övning VMA — ingen fara föreligger',
    leveranser: [{ kanal: 'push', kontakt: 'iPhone', smeknamn: '' }],
  },
  {
    id: 9, tid: '2026-03-17 17:30', kalla: 'Trafikverket', rubrik: 'Broöppning på Göta älv — förseningar väntas',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' },
      { kanal: 'sms',   kontakt: '073-XXX XX XX', smeknamn: 'Mamma' },
    ],
  },
  {
    id: 10, tid: '2026-03-17 09:15', kalla: 'SMHI', rubrik: 'Smältvatten kan ge översvämningar i västra Götaland',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 11, tid: '2026-03-16 11:45', kalla: 'Polisen', rubrik: 'Efterlysning — hjälp oss hitta försvunnen person',
    leveranser: [{ kanal: 'sms', kontakt: '073-XXX XX XX', smeknamn: 'Mamma' }],
  },
  {
    id: 12, tid: '2026-03-16 08:30', kalla: 'SMHI', rubrik: 'Åskväder väntas under eftermiddagen',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 13, tid: '2026-03-15 19:00', kalla: 'MSB', rubrik: 'Skogsbrandsrisk — eldningsförbud i kraft',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' },
      { kanal: 'push',  kontakt: 'iPhone',        smeknamn: ''    },
    ],
  },
  {
    id: 14, tid: '2026-03-15 10:15', kalla: 'Trafikverket', rubrik: 'Olycka på E20 — kö bildas',
    leveranser: [{ kanal: 'sms', kontakt: '073-XXX XX XX', smeknamn: 'Mamma' }],
  },
  {
    id: 15, tid: '2026-03-14 14:45', kalla: 'Polisen', rubrik: 'Bedrägeriförsök via telefon rapporteras i området',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 16, tid: '2026-03-14 09:00', kalla: 'SMHI', rubrik: 'Kraftig vind längs västkusten — klass 2-varning',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se',   smeknamn: 'Mig'    },
      { kanal: 'sms',   kontakt: '076-XXX XX XX',  smeknamn: 'Mormor' },
    ],
  },
  {
    id: 17, tid: '2026-03-13 16:20', kalla: 'MSB', rubrik: 'Kemikalieläckage vid industriområde i Mölndal',
    leveranser: [{ kanal: 'push', kontakt: 'iPhone', smeknamn: '' }],
  },
  {
    id: 18, tid: '2026-03-13 08:45', kalla: 'Trafikverket', rubrik: 'Vägarbete på riksväg 45 — halvljus krävs',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 19, tid: '2026-03-12 17:10', kalla: 'Polisen', rubrik: 'Trafikolycka vid Kungsbacka — en person skadad',
    leveranser: [{ kanal: 'sms', kontakt: '073-XXX XX XX', smeknamn: 'Mamma' }],
  },
  {
    id: 20, tid: '2026-03-12 11:30', kalla: 'SMHI', rubrik: 'Dimma på morgonen — sikten under 100 meter',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 21, tid: '2026-03-11 15:00', kalla: 'MSB', rubrik: 'Information om radonmätning i bostäder',
    leveranser: [{ kanal: 'push', kontakt: 'iPhone', smeknamn: '' }],
  },
  {
    id: 22, tid: '2026-03-11 09:20', kalla: 'Polisen', rubrik: 'Stölder från fordon ökar — tips för att skydda dig',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 23, tid: '2026-03-10 18:45', kalla: 'Trafikverket', rubrik: 'Bro stängs av för inspektion under natten',
    leveranser: [
      { kanal: 'epost', kontakt: 'din@epost.se',  smeknamn: 'Mig'   },
      { kanal: 'sms',   kontakt: '073-XXX XX XX', smeknamn: 'Mamma' },
    ],
  },
  {
    id: 24, tid: '2026-03-10 10:00', kalla: 'SMHI', rubrik: 'Värmebölja väntas nästa vecka — drick vatten',
    leveranser: [{ kanal: 'epost', kontakt: 'din@epost.se', smeknamn: 'Mig' }],
  },
  {
    id: 25, tid: '2026-03-09 14:30', kalla: 'Polisen', rubrik: 'Polisen söker vittnen till incident i Haga',
    leveranser: [{ kanal: 'sms', kontakt: '076-XXX XX XX', smeknamn: 'Mormor' }],
  },
]

const FLIKAR: { key: Filter; label: string }[] = [
  { key: 'alla',  label: 'Alla'   },
  { key: 'epost', label: 'E-post' },
  { key: 'sms',   label: 'SMS'    },
  { key: 'push',  label: 'Push'   },
]

const ALLA_MOTTAGARE = Array.from(new Set(
  MOCK.flatMap(n => n.leveranser.map(l => l.smeknamn || l.kontakt))
))

function formatTid(tid: string): { datum: string; klocka: string } {
  const [datum, klocka] = tid.split(' ')
  return { datum, klocka }
}

export default function NotisHistorik() {
  const [filter,         setFilter]         = useState<Filter>('alla')
  const [valda,          setValda]          = useState<string[]>([])
  const [dropdownOpen,   setDropdownOpen]   = useState(false)
  const [sida,           setSida]           = useState(1)
  const dropdownRef                         = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleMottagare(m: string) {
    setValda(prev => prev.includes(m) ? prev.filter(v => v !== m) : [...prev, m])
  }

  function taBort(m: string) {
    setValda(prev => prev.filter(v => v !== m))
  }

  const aktivaMottagare = valda.length === 0 ? null : valda

  const filtrerade = MOCK.filter(n => {
    const kanalMatch     = filter === 'alla' || n.leveranser.some(l => l.kanal === filter)
    const mottagareMatch = !aktivaMottagare || n.leveranser.some(l =>
      aktivaMottagare.includes(l.smeknamn || l.kontakt)
    )
    return kanalMatch && mottagareMatch
  })

  const totalSidor = Math.ceil(filtrerade.length / PER_SIDA)
  const visade     = filtrerade.slice((sida - 1) * PER_SIDA, sida * PER_SIDA)

  function byttFilter(fn: () => void) {
    fn()
    setSida(1)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">📋</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Notifieringshistorik</h2>
            <p className="text-sm text-slate-500 mt-0.5">Senast skickade notiser</p>
          </div>
        </div>
      </div>

      {/* Kanalflikar */}
      <div className="px-6 pt-4 pb-0 flex gap-1 border-b border-slate-100">
        {FLIKAR.map(f => (
          <button
            key={f.key}
            onClick={() => byttFilter(() => setFilter(f.key))}
            className={`flex-1 py-1.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              filter === f.key
                ? 'text-violet-600 border-violet-500 bg-violet-50'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <span className="flex items-center justify-center gap-3">
              <span>{f.label}</span>
              {f.key !== 'alla' && (
                <span className="text-slate-400 font-semibold tabular-nums">
                  {MOCK.filter(n => n.leveranser.some(l => l.kanal === f.key)).length}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Mottagarflikar — dynamiska */}
      <div className="px-6 flex items-end gap-1 border-b border-slate-100">

        {/* Alla-flik */}
        <button
          onClick={() => byttFilter(() => setValda([]))}
          className={`py-1.5 px-4 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            valda.length === 0
              ? 'text-violet-600 border-violet-500 bg-violet-50'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
        >
          Alla
        </button>

        {/* Valda mottagare som flikar med × */}
        {valda.map(m => (
          <div
            key={m}
            className="flex items-center gap-1 py-1.5 px-3 text-xs font-semibold text-violet-600 border-b-2 border-violet-500 bg-violet-50 -mb-px"
          >
            <span>{m}</span>
            <button
              onClick={() => taBort(m)}
              className="text-violet-400 hover:text-violet-700 transition-colors ml-0.5"
            >
              ×
            </button>
          </div>
        ))}

        {/* Lägg till-knapp med dropdown */}
        <div className="relative mb-px ml-1" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className="flex items-center gap-1 py-1.5 px-3 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            + Lägg till
            <span className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[10rem] py-1">
              {ALLA_MOTTAGARE.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMottagare(m)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    valda.includes(m)
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-slate-300'
                  }`}>
                    {valda.includes(m) && <span className="text-[9px] leading-none">✓</span>}
                  </span>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Body — fast höjd */}
      <div className="flex flex-col h-[34rem]">

      {/* Lista — scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
          {filtrerade.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-400">Inga notiser matchar valt filter</p>
            </div>
          ) : (
            visade.map(n => {
              const { datum, klocka } = formatTid(n.tid)

              const perKanal = (['epost', 'sms', 'push'] as Kanal[])
                .map(k => ({ kanal: k, leveranser: n.leveranser.filter(l => l.kanal === k) }))
                .filter(g => g.leveranser.length > 0)

              return (
                <div key={n.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">

                  {/* Tidsstämpel */}
                  <div className="text-right shrink-0 w-20 pt-0.5">
                    <p className="text-xs font-medium text-slate-700">{klocka}</p>
                    <p className="text-xs text-slate-400">{datum}</p>
                  </div>

                  <div className="w-px self-stretch bg-slate-100 shrink-0" />

                  {/* Källa + rubrik + leveranser */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">{n.kalla}</p>
                    <a
                      href={`/handelse/${n.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-violet-600 hover:underline transition-colors mb-2 block"
                    >
                      {n.rubrik}
                    </a>

                    {/* Kanaler med mottagare */}
                    <div className="flex flex-col gap-1">
                      {perKanal.map(g => (
                        <div key={g.kanal} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>{KANAL_IKON[g.kanal]}</span>
                          <span className="font-medium text-slate-400 shrink-0">{KANAL_NAMN[g.kanal]}</span>
                          <span className="text-slate-600">
                            {g.leveranser.map((l, i) => (
                              <span key={i}>{i > 0 && ' · '}{l.smeknamn || l.kontakt}</span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>

      {/* Paginering — fastpinnad längst ned */}
      <div className="shrink-0 flex items-center justify-center gap-1 px-6 py-4 border-t border-slate-100">
      {totalSidor > 1 ? (<>
            <button
              onClick={() => setSida(p => Math.max(1, p - 1))}
              disabled={sida === 1}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-default transition-colors rounded-lg hover:bg-slate-50"
            >
              ←
            </button>

            {Array.from({ length: totalSidor }, (_, i) => i + 1).map(s => (
              <button
                key={s}
                onClick={() => setSida(s)}
                className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors ${
                  s === sida
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}

            <button
              onClick={() => setSida(p => Math.min(totalSidor, p + 1))}
              disabled={sida === totalSidor}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-default transition-colors rounded-lg hover:bg-slate-50"
            >
              →
            </button>
        </>) : null}
      </div>

      </div>

    </div>
  )
}
