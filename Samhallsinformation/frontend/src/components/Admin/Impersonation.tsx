import { useState } from 'react'
import type { AdminSection } from './AdminSidebar'
import { MockBanner, MockBadge, IngetKopplatAn } from '../common/MockBadge'

interface ImpersonationProps {
  onNavigate: (section: AdminSection) => void
}

type Roll = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status = 'Aktiv' | 'Inaktiv' | 'Avstängd'
type Inloggningsmetod = 'E-post' | 'Google' | 'BankID'

interface AnvändareSök {
  id: number
  namn: string
  epost: string
  roller: Roll[]
  status: Status
  inloggningsmetod: Inloggningsmetod
  telefon?: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Påhittade exempelanvändare — inga riktiga konton. Sidan är en MOCK (V3-20, D3).
const ANVÄNDARE: AnvändareSök[] = [
  {
    id: 1,
    namn: 'Joakim Rehn',
    epost: 'joakim@example.com',
    roller: ['Admin', 'Support', 'Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'E-post',
    telefon: '+46 70 123 45 67',
  },
  {
    id: 2,
    namn: 'Anna Svensson',
    epost: 'anna.svensson@mail.se',
    roller: ['Support', 'Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'Google',
    telefon: '+46 73 234 56 78',
  },
  {
    id: 3,
    namn: 'Erik Lindqvist',
    epost: 'erik.l@gmail.com',
    roller: ['Betatestare', 'Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'Google',
    telefon: '+46 76 345 67 89',
  },
  {
    id: 4,
    namn: 'Maria Johansson',
    epost: 'maria.j@outlook.com',
    roller: ['Betatestare', 'Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'E-post',
  },
  {
    id: 5,
    namn: 'Lars Petersson',
    epost: 'lars.p@hotmail.com',
    roller: ['Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'E-post',
  },
  {
    id: 6,
    namn: 'Sofia Nilsson',
    epost: 'sofia.n@gmail.com',
    roller: ['Betatestare', 'Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'Google',
    telefon: '+46 72 456 78 90',
  },
  {
    id: 7,
    namn: 'Johan Karlsson',
    epost: 'johan.k@company.se',
    roller: ['Användare'],
    status: 'Inaktiv',
    inloggningsmetod: 'E-post',
  },
  {
    id: 8,
    namn: 'Karin Andersson',
    epost: 'karin.a@mail.se',
    roller: ['Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'BankID',
    telefon: '+46 70 567 89 01',
  },
  {
    id: 9,
    namn: 'Magnus Bergström',
    epost: 'magnus.b@gmail.com',
    roller: ['Betatestare', 'Användare'],
    status: 'Avstängd',
    inloggningsmetod: 'E-post',
  },
  {
    id: 10,
    namn: 'Lena Holm',
    epost: 'lena.h@outlook.com',
    roller: ['Användare'],
    status: 'Aktiv',
    inloggningsmetod: 'BankID',
    telefon: '+46 73 678 90 12',
  },
]

// ---------------------------------------------------------------------------
// Konstanter / hjälpare
// ---------------------------------------------------------------------------

const ROLL_CLS: Record<Roll, string> = {
  Admin: 'bg-red-100 text-red-700 border border-red-200',
  Support: 'bg-violet-100 text-violet-700 border border-violet-200',
  Betatestare: 'bg-amber-100 text-amber-700 border border-amber-200',
  Användare: 'bg-slate-100 text-slate-600 border border-slate-200',
}

const STATUS_CLS: Record<Status, string> = {
  Aktiv: 'bg-green-100 text-green-700 border border-green-200',
  Inaktiv: 'bg-slate-100 text-slate-500 border border-slate-200',
  Avstängd: 'bg-red-100 text-red-700 border border-red-200',
}

const STATUS_DOT: Record<Status, string> = {
  Aktiv: 'bg-green-500',
  Inaktiv: 'bg-slate-300',
  Avstängd: 'bg-red-500',
}

const INLOGGNING_CLS: Record<Inloggningsmetod, string> = {
  'E-post': 'bg-slate-100 text-slate-600 border border-slate-200',
  Google: 'bg-blue-100 text-blue-700 border border-blue-200',
  BankID: 'bg-sky-100 text-sky-700 border border-sky-200',
}

const ALLA_ROLLER: Array<Roll | 'Alla'> = ['Alla', 'Admin', 'Support', 'Betatestare', 'Användare']
const ALLA_STATUSAR: Array<Status | 'Alla'> = ['Alla', 'Aktiv', 'Inaktiv', 'Avstängd']
const ALLA_INLOGGNING: Array<Inloggningsmetod | 'Alla'> = ['Alla', 'E-post', 'Google', 'BankID']

function initialer(namn: string) {
  return namn
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function Impersonation({ onNavigate: _onNavigate }: ImpersonationProps) {
  const [sökning, setSökning] = useState('')
  const [rollFilter, setRollFilter] = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter] = useState<Status | 'Alla'>('Alla')
  const [inloggFilter, setInloggFilter] = useState<Inloggningsmetod | 'Alla'>('Alla')

  function matchSökning(u: AnvändareSök): boolean {
    const t = sökning.trim()
    if (!t) return true

    if (t.startsWith('#')) {
      const idDel = t.slice(1)
      return idDel === '' || String(u.id).startsWith(idDel)
    }

    const namnMatch = t.match(/^(namn|name):\s*(.*)/i)
    if (namnMatch) {
      return u.namn.toLowerCase().includes(namnMatch[2].toLowerCase())
    }

    const mailMatch = t.match(/^(mail|epost|e-post):\s*(.*)/i)
    if (mailMatch) {
      return u.epost.toLowerCase().includes(mailMatch[2].toLowerCase())
    }

    const telMatch = t.match(/^(tel|telefon):\s*(.*)/i)
    if (telMatch) {
      const val = telMatch[2].replace(/\s/g, '')
      return !!u.telefon && u.telefon.replace(/\s/g, '').includes(val)
    }

    // Bred sökning utan prefix
    const s = t.toLowerCase()
    return (
      u.namn.toLowerCase().includes(s) ||
      u.epost.toLowerCase().includes(s) ||
      String(u.id).includes(s) ||
      (!!u.telefon && u.telefon.replace(/\s/g, '').includes(s.replace(/\s/g, '')))
    )
  }

  const filtrerade = ANVÄNDARE.filter((u) => {
    if (rollFilter !== 'Alla' && !u.roller.includes(rollFilter)) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (inloggFilter !== 'Alla' && u.inloggningsmetod !== inloggFilter) return false
    return matchSökning(u)
  })

  return (
    <div className="flex flex-col gap-6">
      <MockBanner>
        Impersonation finns inte på riktigt: det finns ingen backend som ger en admin en session som
        en annan användare, och inget loggas i aktivitetsloggen. Användarna nedan är påhittade
        exempel — inte riktiga konton — och knapparna är avstängda så att inget låtsas hända.
      </MockBanner>

      {/* Sök & filtrera */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            Sök användare <MockBadge />
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Filtrera på namn, e-post, ID eller telefonnummer
          </p>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3 border-b border-slate-100">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={sökning}
              onChange={(e) => setSökning(e.target.value)}
              placeholder="#3 · namn: Anna · mail: anna@ · tel: 070..."
              className="text-sm border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full"
            />
            <p className="text-xs text-slate-400 pl-1">
              Prefix: <code className="bg-slate-100 px-1 rounded">#</code> ID &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">namn:</code> &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">mail:</code> &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">tel:</code> &nbsp;— utan prefix söks alla
              fält
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Roll</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_ROLLER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRollFilter(r)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Status</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_STATUSAR.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Inloggning</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_INLOGGNING.map((i) => (
                  <button
                    key={i}
                    onClick={() => setInloggFilter(i)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${inloggFilter === i ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Resultat */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Användare</th>
              <th className="text-left px-4 py-3 font-medium">Roller</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Inloggning</th>
              <th className="text-left px-4 py-3 font-medium">Telefon</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                      {initialer(u.namn)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.namn}</p>
                      <p className="text-xs text-slate-400">
                        {u.epost} · ID #{u.id}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roller.map((r) => (
                      <span
                        key={r}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLL_CLS[r]}`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INLOGGNING_CLS[u.inloggningsmetod]}`}
                  >
                    {u.inloggningsmetod}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500">
                  {u.telefon ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    disabled
                    title="Inte kopplat — impersonation saknar backend"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed whitespace-nowrap"
                  >
                    Inte tillgängligt
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

      {/* Sessionshistorik — ingen data finns, så ingen påhittad historik visas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Sessionshistorik</h3>
        </div>
        <IngetKopplatAn rubrik="Ingen sessionshistorik">
          Inga impersonation-sessioner startas eller sparas, så det finns inget riktigt spår att
          visa.
        </IngetKopplatAn>
      </div>
    </div>
  )
}
