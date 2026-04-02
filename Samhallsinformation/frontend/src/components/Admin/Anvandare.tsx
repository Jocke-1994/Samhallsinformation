import { useState } from 'react'

type Roll = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status = 'Aktiv' | 'Inaktiv' | 'Avstängd'

interface Användare {
  id:          number
  namn:        string
  epost:       string
  roll:        Roll
  status:      Status
  registrerad: string
  senastAktiv: string
}

const MOCK_ANVÄNDARE: Användare[] = [
  { id: 1,  namn: 'Joakim Rehn',        epost: 'joakim@example.com',       roll: 'Admin',       status: 'Aktiv',    registrerad: '2026-01-15', senastAktiv: 'Idag 10:42'      },
  { id: 2,  namn: 'Anna Svensson',       epost: 'anna.svensson@mail.se',    roll: 'Support',     status: 'Aktiv',    registrerad: '2026-02-03', senastAktiv: 'Idag 09:15'      },
  { id: 3,  namn: 'Erik Lindqvist',      epost: 'erik.l@gmail.com',         roll: 'Betatestare', status: 'Aktiv',    registrerad: '2026-03-10', senastAktiv: 'Igår 18:30'      },
  { id: 4,  namn: 'Maria Johansson',     epost: 'maria.j@outlook.com',      roll: 'Betatestare', status: 'Aktiv',    registrerad: '2026-03-12', senastAktiv: 'Igår 14:05'      },
  { id: 5,  namn: 'Lars Petersson',      epost: 'lars.p@hotmail.com',       roll: 'Användare',   status: 'Aktiv',    registrerad: '2026-03-18', senastAktiv: '2026-03-30'      },
  { id: 6,  namn: 'Sofia Nilsson',       epost: 'sofia.n@gmail.com',        roll: 'Betatestare', status: 'Aktiv',    registrerad: '2026-03-20', senastAktiv: 'Idag 08:50'      },
  { id: 7,  namn: 'Johan Karlsson',      epost: 'johan.k@company.se',       roll: 'Användare',   status: 'Inaktiv',  registrerad: '2026-03-22', senastAktiv: '2026-03-25'      },
  { id: 8,  namn: 'Karin Andersson',     epost: 'karin.a@mail.se',          roll: 'Användare',   status: 'Aktiv',    registrerad: '2026-03-25', senastAktiv: 'Idag 11:20'      },
  { id: 9,  namn: 'Magnus Bergström',    epost: 'magnus.b@gmail.com',       roll: 'Betatestare', status: 'Avstängd', registrerad: '2026-03-26', senastAktiv: '2026-03-28'      },
  { id: 10, namn: 'Lena Holm',           epost: 'lena.h@outlook.com',       roll: 'Användare',   status: 'Aktiv',    registrerad: '2026-03-28', senastAktiv: 'Igår 21:10'      },
]

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

const ALLA_ROLLER: Array<Roll | 'Alla'> = ['Alla', 'Admin', 'Support', 'Betatestare', 'Användare']
const ALLA_STATUSAR: Array<Status | 'Alla'> = ['Alla', 'Aktiv', 'Inaktiv', 'Avstängd']

export default function Anvandare() {
  const [rollFilter, setRollFilter] = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter] = useState<Status | 'Alla'>('Alla')
  const [sökning, setSökning] = useState('')
  const [vald, setVald] = useState<Användare | null>(null)

  const filtrerade = MOCK_ANVÄNDARE.filter(u => {
    if (rollFilter !== 'Alla' && u.roll !== rollFilter) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (sökning && !u.namn.toLowerCase().includes(sökning.toLowerCase()) &&
        !u.epost.toLowerCase().includes(sökning.toLowerCase())) return false
    return true
  })

  const antal = {
    totalt:      MOCK_ANVÄNDARE.length,
    aktiva:      MOCK_ANVÄNDARE.filter(u => u.status === 'Aktiv').length,
    betatestare: MOCK_ANVÄNDARE.filter(u => u.roll === 'Betatestare').length,
    avstängda:   MOCK_ANVÄNDARE.filter(u => u.status === 'Avstängd').length,
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Statistik */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Totalt',      värde: antal.totalt,      färg: 'text-slate-800'  },
          { label: 'Aktiva',      värde: antal.aktiva,      färg: 'text-green-600'  },
          { label: 'Betatestare', värde: antal.betatestare, färg: 'text-amber-600'  },
          { label: 'Avstängda',   värde: antal.avstängda,   färg: 'text-red-600'    },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
            <p className={`text-3xl font-bold ${s.färg}`}>{s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabell */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">

          {/* Sök */}
          <input
            type="text"
            placeholder="Sök namn eller e-post..."
            value={sökning}
            onChange={e => setSökning(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-56"
          />

          {/* Roll-filter */}
          <div className="flex gap-1 ml-auto">
            {ALLA_ROLLER.map(r => (
              <button
                key={r}
                onClick={() => setRollFilter(r)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Status-filter */}
          <div className="flex gap-1">
            {ALLA_STATUSAR.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Användare</th>
              <th className="text-left px-4 py-3 font-medium">Roll</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Registrerad</th>
              <th className="text-left px-4 py-3 font-medium">Senast aktiv</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map(u => (
              <tr
                key={u.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setVald(u)}
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                      {u.namn.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.namn}</p>
                      <p className="text-xs text-slate-400">{u.epost}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[u.roll]}`}>
                    {u.roll}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[u.status]}`} />
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[u.status]}`}>
                      {u.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.registrerad}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.senastAktiv}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
                    Detaljer →
                  </button>
                </td>
              </tr>
            ))}
            {filtrerade.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
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
                {vald.namn.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{vald.namn}</p>
                <p className="text-xs text-slate-400">{vald.epost}</p>
              </div>
            </div>
            <button onClick={() => setVald(null)} className="text-slate-400 hover:text-slate-600 transition-colors text-lg">✕</button>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Roll</p>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[vald.roll]}`}>{vald.roll}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Status</p>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[vald.status]}`}>{vald.status}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Registrerad</p>
                <p className="text-sm text-slate-700">{vald.registrerad}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Senast aktiv</p>
                <p className="text-sm text-slate-700">{vald.senastAktiv}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Åtgärder</p>
              <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                Ändra roll
              </button>
              <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                Skicka lösenordsåterställning
              </button>
              <button className="text-left px-4 py-2.5 rounded-xl border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                Stäng av konto tillfälligt
              </button>
              <button className="text-left px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors">
                Radera konto (GDPR)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
