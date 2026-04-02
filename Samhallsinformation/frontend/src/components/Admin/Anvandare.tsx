import { useState } from 'react'

type Roll = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status = 'Aktiv' | 'Inaktiv' | 'Avstängd'
type DetaljFlik = 'oversikt' | 'notishistorik' | 'aktivitet'

interface Användare {
  id:          number
  namn:        string
  epost:       string
  roller:      Roll[]
  status:      Status
  registrerad: string
  senastAktiv: string
}

interface NotisRad {
  tid:    string
  kanal:  'E-post' | 'SMS'
  källa:  string
  rubrik: string
  status: 'Levererad' | 'Misslyckad' | 'Väntande'
}

interface AktivitetRad {
  tid:      string
  händelse: string
}

const MOCK_ANVÄNDARE: Användare[] = [
  { id: 1,  namn: 'Joakim Rehn',     epost: 'joakim@example.com',    roller: ['Admin', 'Support', 'Användare'], status: 'Aktiv',    registrerad: '2026-01-15', senastAktiv: 'Idag 10:42' },
  { id: 2,  namn: 'Anna Svensson',   epost: 'anna.svensson@mail.se', roller: ['Support', 'Användare'],          status: 'Aktiv',    registrerad: '2026-02-03', senastAktiv: 'Idag 09:15' },
  { id: 3,  namn: 'Erik Lindqvist',  epost: 'erik.l@gmail.com',      roller: ['Betatestare', 'Användare'],      status: 'Aktiv',    registrerad: '2026-03-10', senastAktiv: 'Igår 18:30' },
  { id: 4,  namn: 'Maria Johansson', epost: 'maria.j@outlook.com',   roller: ['Betatestare', 'Användare'],      status: 'Aktiv',    registrerad: '2026-03-12', senastAktiv: 'Igår 14:05' },
  { id: 5,  namn: 'Lars Petersson',  epost: 'lars.p@hotmail.com',    roller: ['Användare'],                     status: 'Aktiv',    registrerad: '2026-03-18', senastAktiv: '2026-03-30' },
  { id: 6,  namn: 'Sofia Nilsson',   epost: 'sofia.n@gmail.com',     roller: ['Betatestare', 'Användare'],      status: 'Aktiv',    registrerad: '2026-03-20', senastAktiv: 'Idag 08:50' },
  { id: 7,  namn: 'Johan Karlsson',  epost: 'johan.k@company.se',    roller: ['Användare'],                     status: 'Inaktiv',  registrerad: '2026-03-22', senastAktiv: '2026-03-25' },
  { id: 8,  namn: 'Karin Andersson', epost: 'karin.a@mail.se',       roller: ['Användare'],                     status: 'Aktiv',    registrerad: '2026-03-25', senastAktiv: 'Idag 11:20' },
  { id: 9,  namn: 'Magnus Bergström',epost: 'magnus.b@gmail.com',    roller: ['Betatestare', 'Användare'],      status: 'Avstängd', registrerad: '2026-03-26', senastAktiv: '2026-03-28' },
  { id: 10, namn: 'Lena Holm',       epost: 'lena.h@outlook.com',    roller: ['Användare'],                     status: 'Aktiv',    registrerad: '2026-03-28', senastAktiv: 'Igår 21:10' },
]

const MOCK_NOTISER: Record<number, NotisRad[]> = {
  3: [
    { tid: '2026-04-02 10:30', kanal: 'E-post', källa: 'Polisen', rubrik: 'Skottlossning, Norrköping',                    status: 'Levererad'  },
    { tid: '2026-04-01 18:15', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Explosion, Göteborg',                          status: 'Levererad'  },
    { tid: '2026-04-01 09:00', kanal: 'E-post', källa: 'SMHI',    rubrik: 'Klass 2-varning: hård vind, Västra Götaland',  status: 'Levererad'  },
    { tid: '2026-03-30 14:42', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Bedrägeri via telefon, nationellt',             status: 'Misslyckad' },
    { tid: '2026-03-29 08:00', kanal: 'E-post', källa: 'MSB',     rubrik: 'Krisberedskapsinfo: övning Västkust',           status: 'Levererad'  },
  ],
  6: [
    { tid: '2026-04-02 11:00', kanal: 'E-post', källa: 'Polisen', rubrik: 'Rån, Göteborg',              status: 'Levererad' },
    { tid: '2026-04-01 22:30', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Brand i lägenhet, Malmö',    status: 'Väntande'  },
  ],
}

const MOCK_AKTIVITET: Record<number, AktivitetRad[]> = {
  3: [
    { tid: 'Idag 10:42',  händelse: 'Loggade in'                            },
    { tid: 'Idag 10:43',  händelse: 'Öppnade Polisen-källan'                },
    { tid: 'Igår 18:30',  händelse: 'Loggade in'                            },
    { tid: 'Igår 18:31',  händelse: 'Uppdaterade notifieringsinställningar' },
    { tid: '2026-03-30',  händelse: 'Registrerade e-postadress'             },
    { tid: '2026-03-10',  händelse: 'Skapade konto'                         },
  ],
  6: [
    { tid: 'Idag 08:50',  händelse: 'Loggade in'                            },
    { tid: 'Igår 20:10',  händelse: 'Läste 4 artiklar från Polisen'         },
    { tid: '2026-03-20',  händelse: 'Skapade konto'                         },
  ],
}

const ROLL_CLS: Record<Roll, string> = {
  'Admin':       'bg-red-100 text-red-700 border border-red-200',
  'Support':     'bg-violet-100 text-violet-700 border border-violet-200',
  'Betatestare': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Användare':   'bg-slate-100 text-slate-600 border border-slate-200',
}

const STATUS_CLS: Record<Status, string> = {
  'Aktiv':    'bg-green-100 text-green-700 border border-green-200',
  'Inaktiv':  'bg-slate-100 text-slate-500 border border-slate-200',
  'Avstängd': 'bg-red-100 text-red-700 border border-red-200',
}

const STATUS_DOT: Record<Status, string> = {
  'Aktiv':    'bg-green-500',
  'Inaktiv':  'bg-slate-300',
  'Avstängd': 'bg-red-500',
}

const NOTIS_STATUS_CLS: Record<NotisRad['status'], string> = {
  'Levererad':  'bg-green-100 text-green-700 border border-green-200',
  'Misslyckad': 'bg-red-100 text-red-700 border border-red-200',
  'Väntande':   'bg-amber-100 text-amber-700 border border-amber-200',
}

const KANAL_CLS: Record<NotisRad['kanal'], string> = {
  'E-post': 'bg-violet-100 text-violet-700',
  'SMS':    'bg-sky-100 text-sky-700',
}

const ALLA_ROLLER: Array<Roll | 'Alla'> = ['Alla', 'Admin', 'Support', 'Betatestare', 'Användare']
const ALLA_STATUSAR: Array<Status | 'Alla'> = ['Alla', 'Aktiv', 'Inaktiv', 'Avstängd']

function initialer(namn: string) {
  return namn.split(' ').map(n => n[0]).join('').slice(0, 2)
}

export default function Anvandare() {
  const [rollFilter, setRollFilter]     = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter] = useState<Status | 'Alla'>('Alla')
  const [sökning, setSökning]           = useState('')
  const [vald, setVald]                 = useState<Användare | null>(null)
  const [detaljFlik, setDetaljFlik]     = useState<DetaljFlik>('oversikt')
  const [markerade, setMarkerade]       = useState<Set<number>>(new Set())

  const filtrerade = MOCK_ANVÄNDARE.filter(u => {
    if (rollFilter !== 'Alla' && !u.roller.includes(rollFilter)) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (sökning && !u.namn.toLowerCase().includes(sökning.toLowerCase()) &&
        !u.epost.toLowerCase().includes(sökning.toLowerCase()) &&
        !String(u.id).includes(sökning)) return false
    return true
  })

  function toggleMarkerad(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    setMarkerade(prev => {
      const ny = new Set(prev)
      ny.has(id) ? ny.delete(id) : ny.add(id)
      return ny
    })
  }

  function toggleAllaMarkerade() {
    setMarkerade(prev =>
      prev.size === filtrerade.length ? new Set() : new Set(filtrerade.map(u => u.id))
    )
  }

  function öppnaDetalj(u: Användare) {
    setVald(u)
    setDetaljFlik('oversikt')
  }

  const antal = {
    totalt:      MOCK_ANVÄNDARE.length,
    aktiva:      MOCK_ANVÄNDARE.filter(u => u.status === 'Aktiv').length,
    betatestare: MOCK_ANVÄNDARE.filter(u => u.roller.includes('Betatestare')).length,
    avstängda:   MOCK_ANVÄNDARE.filter(u => u.status === 'Avstängd').length,
  }

  const allaMarkerade = filtrerade.length > 0 && markerade.size === filtrerade.length

  return (
    <div className="flex flex-col gap-6">

      {/* Statistik */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Totalt',      värde: antal.totalt,      färg: 'text-slate-800' },
          { label: 'Aktiva',      värde: antal.aktiva,      färg: 'text-green-600' },
          { label: 'Betatestare', värde: antal.betatestare, färg: 'text-amber-600' },
          { label: 'Avstängda',   värde: antal.avstängda,   färg: 'text-red-600'   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
            <p className={`text-3xl font-bold ${s.färg}`}>{s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabell */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap min-h-[60px]">
          {markerade.size > 0 ? (
            <>
              <span className="text-sm font-medium text-violet-700">{markerade.size} markerade</span>
              <div className="flex gap-2 ml-auto">
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Ändra roller</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">Stäng av</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Radera</button>
                <button onClick={() => setMarkerade(new Set())} className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">✕ Avmarkera</button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Sök namn, e-post eller ID..."
                value={sökning}
                onChange={e => setSökning(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-60"
              />
              <div className="flex gap-1 ml-auto">
                {ALLA_ROLLER.map(r => (
                  <button key={r} onClick={() => setRollFilter(r)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {ALLA_STATUSAR.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="px-6 py-3 w-10">
                <input type="checkbox" checked={allaMarkerade} onChange={toggleAllaMarkerade}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
              </th>
              <th className="text-left px-2 py-3 font-medium w-8">ID</th>
              <th className="text-left px-4 py-3 font-medium">Användare</th>
              <th className="text-left px-4 py-3 font-medium">Roller</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Registrerad</th>
              <th className="text-left px-4 py-3 font-medium">Senast aktiv</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map(u => (
              <tr key={u.id}
                className={`hover:bg-slate-50 transition-colors cursor-pointer ${markerade.has(u.id) ? 'bg-violet-50' : ''}`}
                onClick={() => öppnaDetalj(u)}
              >
                <td className="px-6 py-3" onClick={e => toggleMarkerad(e, u.id)}>
                  <input type="checkbox" checked={markerade.has(u.id)} readOnly
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                </td>
                <td className="px-2 py-3 text-xs text-slate-400 font-mono">#{u.id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                      {initialer(u.namn)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.namn}</p>
                      <p className="text-xs text-slate-400">{u.epost}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roller.map(r => (
                      <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLL_CLS[r]}`}>{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[u.status]}`}>{u.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.registrerad}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.senastAktiv}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors whitespace-nowrap">
                    Detaljer →
                  </button>
                </td>
              </tr>
            ))}
            {filtrerade.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
                  Inga användare matchar filtret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detaljpanel */}
      {vald && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700">
                {initialer(vald.namn)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{vald.namn}</p>
                <p className="text-xs text-slate-400">{vald.epost} · ID #{vald.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                Logga in som
              </button>
              <button onClick={() => setVald(null)} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 px-6">
            {([
              { id: 'oversikt',      label: 'Översikt'      },
              { id: 'notishistorik', label: 'Notishistorik' },
              { id: 'aktivitet',     label: 'Aktivitet'     },
            ] as { id: DetaljFlik; label: string }[]).map(f => (
              <button key={f.id} onClick={() => setDetaljFlik(f.id)}
                className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors ${
                  detaljFlik === f.id
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {detaljFlik === 'oversikt' && (
            <div className="px-6 py-5 grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Roller</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vald.roller.map(r => (
                      <span key={r} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[r]}`}>{r}</span>
                    ))}
                  </div>
                </div>
                {[
                  { label: 'Status',       värde: <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[vald.status]}`}>{vald.status}</span> },
                  { label: 'Registrerad',  värde: <p className="text-sm text-slate-700">{vald.registrerad}</p> },
                  { label: 'Senast aktiv', värde: <p className="text-sm text-slate-700">{vald.senastAktiv}</p> },
                ].map(r => (
                  <div key={r.label}>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{r.label}</p>
                    {r.värde}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Åtgärder</p>
                <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">Ändra roller</button>
                <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">Skicka lösenordsåterställning</button>
                <button className="text-left px-4 py-2.5 rounded-xl border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 transition-colors">Stäng av konto tillfälligt</button>
                <button className="text-left px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors">Radera konto (GDPR)</button>
              </div>
            </div>
          )}

          {detaljFlik === 'notishistorik' && (
            <div>
              {(MOCK_NOTISER[vald.id] ?? []).length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Inga notiser skickade till den här användaren.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">Tid</th>
                      <th className="text-left px-4 py-3 font-medium">Kanal</th>
                      <th className="text-left px-4 py-3 font-medium">Källa</th>
                      <th className="text-left px-4 py-3 font-medium">Rubrik</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MOCK_NOTISER[vald.id].map((n, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">{n.tid}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[n.kanal]}`}>{n.kanal}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{n.källa}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{n.rubrik}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${NOTIS_STATUS_CLS[n.status]}`}>{n.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {detaljFlik === 'aktivitet' && (
            <div className="divide-y divide-slate-50">
              {(MOCK_AKTIVITET[vald.id] ?? []).length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Ingen aktivitet registrerad.</p>
              ) : (
                (MOCK_AKTIVITET[vald.id] ?? []).map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    <span className="text-xs text-slate-400 font-mono w-32 shrink-0">{a.tid}</span>
                    <p className="text-sm text-slate-700">{a.händelse}</p>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}

    </div>
  )
}
