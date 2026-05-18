import { useState } from 'react'
import type { AdminSection } from './AdminSidebar'

interface ImpersonationProps {
  onNavigate: (section: AdminSection) => void
}

type Roll           = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status         = 'Aktiv' | 'Inaktiv' | 'Avstängd'
type Inloggningsmetod = 'E-post' | 'Google' | 'BankID'

interface AnvändareSök {
  id:               number
  namn:             string
  epost:            string
  roller:           Roll[]
  status:           Status
  inloggningsmetod: Inloggningsmetod
  telefon?:         string
}

interface Session {
  id:           number
  adminNamn:    string
  användarNamn: string
  användarId:   number
  start:        string
  längd:        string
  anteckning?:  string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const ANVÄNDARE: AnvändareSök[] = [
  { id: 1,  namn: 'Joakim Rehn',     epost: 'joakim@example.com',      roller: ['Admin', 'Support', 'Användare'],  status: 'Aktiv',    inloggningsmetod: 'E-post', telefon: '+46 70 123 45 67' },
  { id: 2,  namn: 'Anna Svensson',   epost: 'anna.svensson@mail.se',   roller: ['Support', 'Användare'],           status: 'Aktiv',    inloggningsmetod: 'Google', telefon: '+46 73 234 56 78' },
  { id: 3,  namn: 'Erik Lindqvist',  epost: 'erik.l@gmail.com',        roller: ['Betatestare', 'Användare'],       status: 'Aktiv',    inloggningsmetod: 'Google', telefon: '+46 76 345 67 89' },
  { id: 4,  namn: 'Maria Johansson', epost: 'maria.j@outlook.com',     roller: ['Betatestare', 'Användare'],       status: 'Aktiv',    inloggningsmetod: 'E-post'                              },
  { id: 5,  namn: 'Lars Petersson',  epost: 'lars.p@hotmail.com',      roller: ['Användare'],                      status: 'Aktiv',    inloggningsmetod: 'E-post'                              },
  { id: 6,  namn: 'Sofia Nilsson',   epost: 'sofia.n@gmail.com',       roller: ['Betatestare', 'Användare'],       status: 'Aktiv',    inloggningsmetod: 'Google', telefon: '+46 72 456 78 90' },
  { id: 7,  namn: 'Johan Karlsson',  epost: 'johan.k@company.se',      roller: ['Användare'],                      status: 'Inaktiv',  inloggningsmetod: 'E-post'                              },
  { id: 8,  namn: 'Karin Andersson', epost: 'karin.a@mail.se',         roller: ['Användare'],                      status: 'Aktiv',    inloggningsmetod: 'BankID', telefon: '+46 70 567 89 01' },
  { id: 9,  namn: 'Magnus Bergström',epost: 'magnus.b@gmail.com',      roller: ['Betatestare', 'Användare'],       status: 'Avstängd', inloggningsmetod: 'E-post'                              },
  { id: 10, namn: 'Lena Holm',       epost: 'lena.h@outlook.com',      roller: ['Användare'],                      status: 'Aktiv',    inloggningsmetod: 'BankID', telefon: '+46 73 678 90 12' },
]

const MOCK_SESSIONER: Session[] = [
  { id: 1, adminNamn: 'Joakim Rehn', användarNamn: 'Erik Lindqvist',    användarId: 3,  start: '2026-05-16 14:22', längd: '8 min 14 s',  anteckning: 'Kontrollera att +46 76 345 67 89 är inlagt och tar emot SMS-notiser' },
  { id: 2, adminNamn: 'Joakim Rehn', användarNamn: 'Maria Johansson',   användarId: 4,  start: '2026-05-14 09:05', längd: '3 min 47 s',  anteckning: 'Verifiera att notishistorik visas korrekt efter datamigrering' },
  { id: 3, adminNamn: 'Joakim Rehn', användarNamn: 'Magnus Bergström',  användarId: 9,  start: '2026-05-10 11:30', längd: '12 min 02 s', anteckning: 'Kontrollera att avstängt konto blockerar åtkomst korrekt' },
  { id: 4, adminNamn: 'Joakim Rehn', användarNamn: 'Lars Petersson',    användarId: 5,  start: '2026-05-07 16:48', längd: '1 min 55 s'  },
  { id: 5, adminNamn: 'Joakim Rehn', användarNamn: 'Sofia Nilsson',     användarId: 6,  start: '2026-04-30 10:11', längd: '5 min 33 s',  anteckning: 'Repro av bugg SUP-0038 — källknapp saknas i sidebar' },
]

// ---------------------------------------------------------------------------
// Konstanter / hjälpare
// ---------------------------------------------------------------------------

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

const INLOGGNING_CLS: Record<Inloggningsmetod, string> = {
  'E-post': 'bg-slate-100 text-slate-600 border border-slate-200',
  'Google': 'bg-blue-100 text-blue-700 border border-blue-200',
  'BankID': 'bg-sky-100 text-sky-700 border border-sky-200',
}

const ALLA_ROLLER:      Array<Roll | 'Alla'>            = ['Alla', 'Admin', 'Support', 'Betatestare', 'Användare']
const ALLA_STATUSAR:    Array<Status | 'Alla'>          = ['Alla', 'Aktiv', 'Inaktiv', 'Avstängd']
const ALLA_INLOGGNING:  Array<Inloggningsmetod | 'Alla'>= ['Alla', 'E-post', 'Google', 'BankID']

function initialer(namn: string) {
  return namn.split(' ').map(n => n[0]).join('').slice(0, 2)
}

// ---------------------------------------------------------------------------
// Bekräftelsedialog
// ---------------------------------------------------------------------------

function StartSessionModal({ användare, onBekräfta, onStäng }: {
  användare:  AnvändareSök
  onBekräfta: (kommentar: string) => void
  onStäng:    () => void
}) {
  const [kommentar, setKommentar] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Logga in som användare</h2>
            <p className="text-amber-100 text-sm mt-0.5">{användare.namn}</p>
          </div>
          <button onClick={onStäng} className="text-amber-200 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
              {initialer(användare.namn)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{användare.namn}</p>
              <p className="text-xs text-slate-400">{användare.epost} · ID #{användare.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Anteckning <span className="normal-case text-slate-400 font-normal">(frivillig)</span>
            </label>
            <textarea
              rows={2}
              value={kommentar}
              onChange={e => setKommentar(e.target.value)}
              placeholder="T.ex. 'Kontrollera att +46 70 123 45 67 tar emot SMS'"
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder:text-slate-300"
            />
          </div>

          <ul className="text-xs text-slate-600 flex flex-col gap-1.5 pl-1">
            <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0">•</span>En ny flik öppnas med användarens vy</li>
            <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0">•</span>Användaren märker ingenting och loggas inte ut</li>
            <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0">•</span>Sessionen loggas i aktivitetsloggen</li>
          </ul>

          <div className="flex gap-3">
            <button onClick={onStäng} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={() => onBekräfta(kommentar)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors">Öppna session</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function Impersonation({ onNavigate: _onNavigate }: ImpersonationProps) {
  const [sökning, setSökning]           = useState('')
  const [rollFilter, setRollFilter]     = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter] = useState<Status | 'Alla'>('Alla')
  const [inloggFilter, setInloggFilter] = useState<Inloggningsmetod | 'Alla'>('Alla')
  const [sessionMål, setSessionMål]     = useState<AnvändareSök | null>(null)

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

  const filtrerade = ANVÄNDARE.filter(u => {
    if (rollFilter !== 'Alla' && !u.roller.includes(rollFilter)) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (inloggFilter !== 'Alla' && u.inloggningsmetod !== inloggFilter) return false
    return matchSökning(u)
  })

  function startaSession(u: AnvändareSök, kommentar: string) {
    const url = `/?impersonating=${u.id}&namn=${encodeURIComponent(u.namn)}`
    window.open(url, '_blank')
    console.info(`Impersonation started — user #${u.id}, anteckning: "${kommentar}"`)
    setSessionMål(null)
  }

  return (
    <div className="flex flex-col gap-6">

      {sessionMål && (
        <StartSessionModal
          användare={sessionMål}
          onBekräfta={kommentar => startaSession(sessionMål, kommentar)}
          onStäng={() => setSessionMål(null)}
        />
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 flex gap-3 items-start">
        <span className="text-xl shrink-0 mt-0.5">🎭</span>
        <div className="flex flex-col gap-3 flex-1">
          <p className="text-sm text-amber-800">
            Sök fram en användare och klicka <strong>Logga in som</strong> för att öppna en session i en ny flik.
            En tydlig banner visas i fliken. Användaren märker ingenting. Varje session loggas i aktivitetsloggen.
          </p>
          <div className="border-t border-amber-200 pt-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Söksyntax</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {[
                { prefix: '#3',        beskrivning: 'Söker på användar-ID'         },
                { prefix: 'namn: Anna',beskrivning: 'Söker enbart i namn'          },
                { prefix: 'mail: @',   beskrivning: 'Söker enbart i e-postadress'  },
                { prefix: 'tel: 070',  beskrivning: 'Söker enbart i telefonnummer' },
              ].map(({ prefix, beskrivning }) => (
                <div key={prefix} className="flex items-center gap-2">
                  <code className="bg-amber-100 border border-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded font-mono shrink-0">{prefix}</code>
                  <span className="text-xs text-amber-700">{beskrivning}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-0.5">Utan prefix söks namn, e-post, ID och telefonnummer samtidigt.</p>
          </div>
        </div>
      </div>

      {/* Sök & filtrera */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Sök användare</h3>
          <p className="text-xs text-slate-400 mt-0.5">Filtrera på namn, e-post, ID eller telefonnummer</p>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3 border-b border-slate-100">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={sökning}
              onChange={e => setSökning(e.target.value)}
              placeholder="#3 · namn: Anna · mail: anna@ · tel: 070..."
              className="text-sm border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full"
            />
            <p className="text-xs text-slate-400 pl-1">
              Prefix: <code className="bg-slate-100 px-1 rounded">#</code> ID &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">namn:</code> &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">mail:</code> &nbsp;·&nbsp;
              <code className="bg-slate-100 px-1 rounded">tel:</code> &nbsp;— utan prefix söks alla fält
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Roll</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_ROLLER.map(r => (
                  <button key={r} onClick={() => setRollFilter(r)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Status</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_STATUSAR.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Inloggning</span>
              <div className="flex gap-1 flex-wrap">
                {ALLA_INLOGGNING.map(i => (
                  <button key={i} onClick={() => setInloggFilter(i)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${inloggFilter === i ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>
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
            {filtrerade.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                      {initialer(u.namn)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.namn}</p>
                      <p className="text-xs text-slate-400">{u.epost} · ID #{u.id}</p>
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
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INLOGGNING_CLS[u.inloggningsmetod]}`}>
                    {u.inloggningsmetod}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500">
                  {u.telefon ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSessionMål(u)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition-colors whitespace-nowrap"
                  >
                    Logga in som
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

      {/* Sessionshistorik */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Sessionshistorik</h3>
          <p className="text-xs text-slate-400 mt-0.5">Senaste impersonation-sessioner</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Admin</th>
              <th className="text-left px-4 py-3 font-medium">Impersonerade</th>
              <th className="text-left px-4 py-3 font-medium">Anteckning</th>
              <th className="text-left px-4 py-3 font-medium">Start</th>
              <th className="text-left px-4 py-3 font-medium">Längd</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_SESSIONER.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                      {initialer(s.adminNamn)}
                    </div>
                    <span className="text-sm text-slate-700">{s.adminNamn}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                      {initialer(s.användarNamn)}
                    </div>
                    <div>
                      <p className="text-sm text-slate-700">{s.användarNamn}</p>
                      <p className="text-xs text-slate-400">ID #{s.användarId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {s.anteckning
                    ? <p className="text-xs text-slate-500 italic">{s.anteckning}</p>
                    : <span className="text-slate-300 text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">{s.start}</td>
                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{s.längd}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                    Avslutad
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
