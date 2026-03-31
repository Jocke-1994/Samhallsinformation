import { useState } from 'react'
import type { Arende, ArendeStatus } from '../../../types'

type SortField = 'status' | 'skapat' | 'uppdaterat' | null
type SortDir = 'asc' | 'desc'

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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-10 flex flex-col items-center gap-2">
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
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full mb-1 inline-block">{arende.kategori}</span>
          <p className="text-slate-700 font-medium">{arende.amne}</p>
        </td>
        <td className="px-4 py-4">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${STATUS_STYLES[arende.status]}`}>
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

export default function ArendehanteringKort() {
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
    <>
      {/* Statistik */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Alla ärenden"              value={totalt}   color="text-slate-900" />
        <StatCard label="Öppna ärenden"            value={oppna}    color="text-blue-600"  />
        <StatCard label="Ärenden under behandling" value={underBeh} color="text-amber-600" />
        <StatCard label="Hanterade ärenden"        value={losta}    color="text-green-600" />
      </div>

      {/* Skicka ärende + Ärendetabell */}
      <div className="grid grid-cols-4 gap-6">

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
    </>
  )
}
