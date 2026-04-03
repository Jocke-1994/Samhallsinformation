import { useState, useEffect } from 'react'
import type { ArendeStatus } from '../../types'

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

interface Meddelande {
  fran:       'användare' | 'support'
  text:       string
  tid:        string
  intern?:    boolean
  agentNamn?: string
}

interface Påminnelse {
  datum:    string
  tid:      string
  notering: string
}

type SchemaTyp = 'svar' | 'intern' | 'tilldela'

interface SchemalagdÅtgärd {
  id:            string
  typ:           SchemaTyp
  schemasatt:    { datum: string; tid: string }
  skapadAv:      string
  utförd:        boolean
  utförtTid?:    string
  text?:         string
  tilldelaAgent?: string
  instruktion?:  string
}

interface ArendeAdmin {
  id:           string
  kategori:     string
  amne:         string
  status:       ArendeStatus
  skapat:       string
  uppdaterat:   string
  användare:    { namn: string; epost: string }
  tilldelad?:   string
  påminnelse?:  Påminnelse
  schemalagda?: SchemalagdÅtgärd[]
  meddelanden:  Meddelande[]
}

export interface PendingNotis {
  arendeId:  string
  amne:      string
  typ:       'påminnelse' | 'tilldelad'
  notering?: string
  sedan:     string
}

type SortField = 'status' | 'skapat' | 'uppdaterat' | null
type SortDir   = 'asc' | 'desc'
type SvarFlik  = 'svar' | 'intern'

// ---------------------------------------------------------------------------
// Mock-data
// ---------------------------------------------------------------------------

const AGENTER = ['Joakim Rehn', 'Anna Svensson', 'Erik Gustafsson']
const INLOGGAD_AGENT = 'Joakim Rehn'

const INITIAL_ÄRENDEN: ArendeAdmin[] = [
  {
    id: 'SUP-0042', kategori: 'Notifieringar',
    amne: 'Får inte notiser från Polisen trots att det är inställt',
    status: 'Under behandling', skapat: '2026-03-15', uppdaterat: '2026-03-17',
    användare: { namn: 'Erik Lindqvist', epost: 'erik.lindqvist@mail.se' },
    tilldelad: 'Anna Svensson',
    schemalagda: [
      {
        id: 'sch-001', typ: 'tilldela',
        schemasatt: { datum: '2026-04-07', tid: '09:00' },
        skapadAv: 'Joakim Rehn', utförd: false,
        tilldelaAgent: 'Joakim Rehn',
        instruktion: 'Anna — kolla om backend-deploy fixade detta och kontakta användaren.',
      },
    ],
    meddelanden: [
      { fran: 'användare', text: 'Hej! Jag har ställt in notiser från Polisen under Notifieringar men får ändå ingenting. Har testat att logga ut och in utan resultat.', tid: '2026-03-15 09:14' },
      { fran: 'support', text: 'Hej! Tack för att du hör av dig. Kan du bekräfta vilken e-postadress du har registrerad?', tid: '2026-03-16 11:30', agentNamn: 'Anna Svensson' },
      { fran: 'användare', text: 'Det är exempel@mail.se', tid: '2026-03-16 12:05' },
      { fran: 'support', text: 'Kollar backend-loggar — eskalerar till Joakim.', tid: '2026-03-17 08:45', agentNamn: 'Anna Svensson', intern: true },
      { fran: 'support', text: 'Tack! Vi ser en konfigurationsavvikelse och jobbar på en lösning. Vi återkommer inom 24 timmar.', tid: '2026-03-17 09:00', agentNamn: 'Anna Svensson' },
    ],
  },
  {
    id: 'SUP-0041', kategori: 'Konto',
    amne: 'Kan inte byta lösenord, får felmeddelande',
    status: 'Öppet', skapat: '2026-03-18', uppdaterat: '2026-03-18',
    användare: { namn: 'Maria Holm', epost: 'maria.holm@gmail.com' },
    tilldelad: 'Joakim Rehn',
    påminnelse: { datum: '2026-04-05', tid: '10:00', notering: 'Kontrollera om ändringen gick igenom' },
    schemalagda: [
      {
        id: 'sch-002', typ: 'svar',
        schemasatt: { datum: '2026-04-05', tid: '10:30' },
        skapadAv: 'Joakim Rehn', utförd: false,
        text: 'Hej! Vi har nu verifierat att ändringen gick igenom. Prova att byta lösenord igen — det borde fungera nu.',
      },
    ],
    meddelanden: [
      { fran: 'användare', text: 'Försöker byta lösenord via Konto-sidan men sidan laddar om utan att något händer.', tid: '2026-03-18 14:55' },
      { fran: 'support', text: 'Kan ta upp till 30 min innan ändringen går igenom', tid: '2026-04-03 09:34', agentNamn: 'Joakim Rehn', intern: true },
    ],
  },
  {
    id: 'SUP-0038', kategori: 'Tekniskt fel',
    amne: 'Källknappen för SMHI visas inte i menyn',
    status: 'Öppet', skapat: '2026-03-10', uppdaterat: '2026-03-10',
    användare: { namn: 'Jonas Berg', epost: 'j.berg@outlook.com' },
    tilldelad: 'Erik Gustafsson',
    meddelanden: [
      { fran: 'användare', text: 'SMHI-knappen i sidomenyn har försvunnit efter senaste uppdateringen.', tid: '2026-03-10 14:22' },
    ],
  },
  {
    id: 'SUP-0031', kategori: 'Konto',
    amne: 'Vill ta bort mitt konto',
    status: 'Hanterat', skapat: '2026-03-01', uppdaterat: '2026-03-03',
    användare: { namn: 'Anna Svensson', epost: 'anna.svensson@mail.se' },
    meddelanden: [
      { fran: 'användare', text: 'Jag vill radera mitt konto och all min data enligt GDPR.', tid: '2026-03-01 10:00' },
      { fran: 'support', text: 'Hej! Vi har tagit emot din begäran. Kontot raderas inom 30 dagar enligt GDPR art. 17.', tid: '2026-03-02 09:15', agentNamn: 'Joakim Rehn' },
      { fran: 'support', text: 'Kontot är nu raderat. Ärendet stängs.', tid: '2026-03-03 11:00', agentNamn: 'Joakim Rehn' },
    ],
  },
  {
    id: 'SUP-0028', kategori: 'GDPR & uppgifter',
    amne: 'Fråga om GDPR och vilken data som sparas',
    status: 'Stängt', skapat: '2026-02-20', uppdaterat: '2026-02-21',
    användare: { namn: 'Lena Persson', epost: 'lena.p@mail.se' },
    meddelanden: [
      { fran: 'användare', text: 'Vilken data sparar ni om mig som användare?', tid: '2026-02-20 16:45' },
      { fran: 'support', text: 'Vi sparar: namn, e-postadress, dina valda källor och notifieringsinställningar. Ingen annan data.', tid: '2026-02-21 10:20', agentNamn: 'Anna Svensson' },
    ],
  },
  {
    id: 'SUP-0019', kategori: 'Notifieringar',
    amne: 'Notifieringar skickas vid fel tidpunkt',
    status: 'Hanterat', skapat: '2026-02-10', uppdaterat: '2026-02-14',
    användare: { namn: 'Erik Lindqvist', epost: 'erik.lindqvist@mail.se' },
    meddelanden: [
      { fran: 'användare', text: 'Jag har ställt in daglig sammanfattning kl 07:00 men får den vid midnatt istället.', tid: '2026-02-10 08:30' },
      { fran: 'support', text: 'Tack för rapporten! Det var ett fel i tidszonshanteringen. Åtgärdat i version 0.3.1.', tid: '2026-02-14 14:00', agentNamn: 'Joakim Rehn' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Schemalagd execution — pure funktion
// ---------------------------------------------------------------------------

function executeOverdueActions(ärenden: ArendeAdmin[]): ArendeAdmin[] {
  const now = new Date()
  return ärenden.map(a => {
    if (!a.schemalagda?.some(å => !å.utförd)) return a

    let meddelanden = [...a.meddelanden]
    let tilldelad = a.tilldelad
    let harÄndring = false

    const schemalagda = a.schemalagda.map(å => {
      if (å.utförd) return å
      const gräns = new Date(`${å.schemasatt.datum}T${å.schemasatt.tid}:00`)
      if (gräns > now) return å

      const utförtTid = gräns.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
      harÄndring = true

      if (å.typ === 'svar') {
        meddelanden.push({ fran: 'support', text: å.text ?? '', tid: utförtTid, agentNamn: å.skapadAv })
      } else if (å.typ === 'intern') {
        meddelanden.push({ fran: 'support', text: å.text ?? '', tid: utförtTid, agentNamn: å.skapadAv, intern: true })
      } else if (å.typ === 'tilldela') {
        tilldelad = å.tilldelaAgent
        const instrDel = å.instruktion ? ` Instruktion: ${å.instruktion}` : ''
        meddelanden.push({ fran: 'support', text: `Ärendet tilldelades ${å.tilldelaAgent ?? '—'}.${instrDel}`, tid: utförtTid, agentNamn: å.skapadAv, intern: true })
      }
      return { ...å, utförd: true, utförtTid }
    })

    if (!harÄndring) return a
    return { ...a, meddelanden, tilldelad, schemalagda, uppdaterat: new Date().toISOString().split('T')[0] }
  })
}

// ---------------------------------------------------------------------------
// Konstanter & hjälpare
// ---------------------------------------------------------------------------

const STATUS_CLS: Record<ArendeStatus, string> = {
  'Öppet':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Hanterat':         'bg-green-50 text-green-700 border border-green-200',
  'Stängt':           'bg-slate-100 text-slate-500 border border-slate-200',
}
const STATUS_ORDER: ArendeStatus[] = ['Öppet', 'Under behandling', 'Hanterat', 'Stängt']
const ALLA_KATEGORIER = ['Notifieringar', 'Inloggning', 'GDPR & uppgifter', 'Konto', 'Tekniskt fel', 'Önskemål', 'Annat']

const SCHEMA_IKONER: Record<SchemaTyp, string> = { svar: '💬', intern: '🔒', tilldela: '👤' }
const SCHEMA_LABELS: Record<SchemaTyp, string> = {
  svar:     'Svar till användare',
  intern:   'Intern anteckning',
  tilldela: 'Tilldela ärende',
}

function isPåminnelseAktiv(p: Påminnelse): boolean {
  return new Date(`${p.datum}T${p.tid}:00`) <= new Date()
}

function dagarSedan(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24))
}

function slaFärg(dagar: number): string {
  if (dagar <= 3) return 'text-slate-400'
  if (dagar <= 7) return 'text-amber-600'
  return 'text-red-600'
}

function dagText(datum: string): string {
  const d = new Date(datum), idag = new Date(), imorgon = new Date()
  imorgon.setDate(idag.getDate() + 1)
  if (d.toDateString() === idag.toDateString())    return 'Idag'
  if (d.toDateString() === imorgon.toDateString()) return 'Imorgon'
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function nyId(): string {
  return `sch-${Date.now()}`
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function ArendeModal({
  arende, onClose, onSkicka, onStatusChange, onTilldela, onPåminnelse, onSchemalägg, onAvbrytSchema, onUpdateSchema,
}: {
  arende:           ArendeAdmin
  onClose:          () => void
  onSkicka:         (id: string, text: string, intern: boolean) => void
  onStatusChange:   (id: string, status: ArendeStatus) => void
  onTilldela:       (id: string, agent: string) => void
  onPåminnelse:     (id: string, p: Påminnelse | undefined) => void
  onSchemalägg:     (arendeId: string, å: SchemalagdÅtgärd) => void
  onAvbrytSchema:   (arendeId: string, schemaId: string) => void
  onUpdateSchema:   (arendeId: string, å: SchemalagdÅtgärd) => void
}) {
  const [flik, setFlik]                     = useState<SvarFlik>('svar')
  const [text, setText]                     = useState('')
  const [visaPåmForm, setVisaPåmForm]       = useState(false)
  const [påmDatum, setPåmDatum]             = useState(arende.påminnelse?.datum ?? '')
  const [påmTid, setPåmTid]                 = useState(arende.påminnelse?.tid ?? '09:00')
  const [påmNotering, setPåmNotering]       = useState(arende.påminnelse?.notering ?? '')
  const [visaSchemaForm, setVisaSchemaForm] = useState(false)
  const [schTyp, setSchTyp]                 = useState<SchemaTyp>('svar')
  const [schDatum, setSchDatum]             = useState('')
  const [schTid, setSchTid]                 = useState('09:00')
  const [schText, setSchText]               = useState('')
  const [schAgent, setSchAgent]             = useState('')
  const [schInstruktion, setSchInstruktion] = useState('')
  const [expandedId, setExpandedId]         = useState<string | null>(null)
  const [editId, setEditId]                 = useState<string | null>(null)
  const [editText, setEditText]             = useState('')
  const [editDatum, setEditDatum]           = useState('')
  const [editTid, setEditTid]               = useState('09:00')
  const [editAgent, setEditAgent]           = useState('')
  const [editInstruktion, setEditInstruktion] = useState('')

  function startEdit(å: SchemalagdÅtgärd) {
    setEditId(å.id)
    setEditText(å.text ?? '')
    setEditDatum(å.schemasatt.datum)
    setEditTid(å.schemasatt.tid)
    setEditAgent(å.tilldelaAgent ?? '')
    setEditInstruktion(å.instruktion ?? '')
    setExpandedId(null)
  }

  function handleSparaEdit(å: SchemalagdÅtgärd) {
    if (!editDatum) return
    onUpdateSchema(arende.id, {
      ...å,
      schemasatt: { datum: editDatum, tid: editTid },
      text:           å.typ !== 'tilldela' ? editText.trim() : undefined,
      tilldelaAgent:  å.typ === 'tilldela' ? editAgent : å.tilldelaAgent,
      instruktion:    å.typ === 'tilldela' ? editInstruktion.trim() : undefined,
    })
    setEditId(null)
  }

  const stängt = arende.status === 'Hanterat' || arende.status === 'Stängt'
  const p = arende.påminnelse

  function handleSkicka() {
    if (!text.trim()) return
    onSkicka(arende.id, text.trim(), flik === 'intern')
    setText('')
  }

  function handleSparaPåminnelse() {
    if (!påmDatum) return
    onPåminnelse(arende.id, { datum: påmDatum, tid: påmTid, notering: påmNotering.trim() })
    setVisaPåmForm(false)
  }

  function handleTaBortPåminnelse() {
    onPåminnelse(arende.id, undefined)
    setPåmDatum(''); setPåmTid('09:00'); setPåmNotering('')
    setVisaPåmForm(false)
  }

  function handleSpараSchema() {
    if (!schDatum) return
    if ((schTyp === 'svar' || schTyp === 'intern') && !schText.trim()) return
    if (schTyp === 'tilldela' && !schAgent) return
    onSchemalägg(arende.id, {
      id: nyId(), typ: schTyp,
      schemasatt: { datum: schDatum, tid: schTid },
      skapadAv: INLOGGAD_AGENT, utförd: false,
      text: schTyp !== 'tilldela' ? schText.trim() : undefined,
      tilldelaAgent: schTyp === 'tilldela' ? schAgent : undefined,
      instruktion: schTyp === 'tilldela' ? schInstruktion.trim() : undefined,
    })
    setVisaSchemaForm(false)
    setSchTyp('svar'); setSchDatum(''); setSchTid('09:00')
    setSchText(''); setSchAgent(''); setSchInstruktion('')
  }

  const pendingSchema = (arende.schemalagda ?? []).filter(å => !å.utförd)
  const utfördaSchema = (arende.schemalagda ?? []).filter(å => å.utförd)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{arende.id}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{arende.kategori}</span>
            </div>
            <p className="text-base font-semibold text-slate-800 leading-snug">{arende.amne}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl shrink-0 mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Vänster: konversation + svar */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100">
            <div className="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-3">
              {arende.meddelanden.map((m, i) => {
                if (m.intern) return (
                  <div key={i} className="self-stretch">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed flex gap-2">
                      <span className="shrink-0">🔒</span><span>{m.text}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Intern anteckning · {m.agentNamn} · {m.tid}</p>
                  </div>
                )
                const frånAdmin = m.fran === 'support'
                return (
                  <div key={i} className={`flex flex-col gap-1 ${frånAdmin ? 'items-end self-end max-w-[80%]' : 'items-start self-start max-w-[80%]'}`}>
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${frånAdmin ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'}`}>
                      {m.text}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {frånAdmin ? (m.agentNamn ?? 'Support') : arende.användare.namn} · {m.tid}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Svar-formulär */}
            <div className="px-7 py-5 border-t border-slate-200 flex flex-col gap-3 shrink-0">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                {(['svar', 'intern'] as SvarFlik[]).map(f => (
                  <button key={f} onClick={() => setFlik(f)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${flik === f ? (f === 'intern' ? 'bg-white text-amber-700 shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {f === 'intern' ? '🔒 Intern anteckning' : 'Svar till användare'}
                  </button>
                ))}
              </div>
              <textarea
                value={text} onChange={e => setText(e.target.value)} rows={3}
                placeholder={flik === 'svar' ? 'Skriv svar till användaren...' : 'Skriv intern anteckning (visas ej för användaren)...'}
                className={`text-slate-900 text-sm px-3 py-2.5 rounded-lg border focus:outline-none placeholder-slate-400 resize-none ${flik === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-300 focus:border-violet-500'}`}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleSkicka} disabled={!text.trim()}
                  className={`px-4 py-2 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors ${flik === 'intern' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-violet-600 hover:bg-violet-500'}`}
                >
                  {flik === 'intern' ? 'Lägg till anteckning' : 'Skicka svar'}
                </button>
                {!stängt && <>
                  <button onClick={() => onStatusChange(arende.id, 'Hanterat')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Markera hanterat</button>
                  <button onClick={() => onStatusChange(arende.id, 'Stängt')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs rounded-lg transition-colors">Stäng ärende</button>
                </>}
                {stängt && (
                  <button onClick={() => onStatusChange(arende.id, 'Öppet')} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs rounded-lg transition-colors">Öppna igen</button>
                )}
              </div>
            </div>
          </div>

          {/* Höger: metadata */}
          <div className="w-64 shrink-0 flex flex-col overflow-y-auto">

            {/* Användare */}
            <div className="px-5 py-5 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Inlämnat av</p>
              <p className="text-sm font-medium text-slate-800">{arende.användare.namn}</p>
              <p className="text-xs text-slate-400">{arende.användare.epost}</p>
              <p className="text-xs text-slate-400 mt-1">Skapat {arende.skapat}</p>
            </div>

            {/* Status */}
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Status</p>
              <select value={arende.status} onChange={e => onStatusChange(arende.id, e.target.value as ArendeStatus)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none whitespace-nowrap w-full ${STATUS_CLS[arende.status]}`}
              >
                {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Tilldelad */}
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Tilldelad</p>
              <select value={arende.tilldelad ?? ''} onChange={e => onTilldela(arende.id, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full"
              >
                <option value="">— Ingen —</option>
                {AGENTER.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Påminnelse */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Påminnelse</p>
                <button onClick={() => setVisaPåmForm(v => !v)} className="text-[11px] text-violet-600 hover:text-violet-500">
                  {p ? 'Ändra' : '+ Lägg till'}
                </button>
              </div>
              {p && !visaPåmForm && (
                <div className={`rounded-lg px-3 py-2.5 text-xs flex flex-col gap-1 ${isPåminnelseAktiv(p) ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span>{isPåminnelseAktiv(p) ? '🔴' : '⏰'}</span>
                    <span>{dagText(p.datum)} kl {p.tid}</span>
                  </div>
                  {p.notering && <p className="text-slate-500 leading-snug">{p.notering}</p>}
                  <button onClick={handleTaBortPåminnelse} className="text-slate-400 hover:text-red-500 text-left mt-1 transition-colors">Ta bort</button>
                </div>
              )}
              {!p && !visaPåmForm && <p className="text-xs text-slate-300">Ingen påminnelse satt.</p>}
              {visaPåmForm && (
                <div className="flex flex-col gap-2">
                  <input type="date" value={påmDatum} onChange={e => setPåmDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full" />
                  <input type="time" value={påmTid} onChange={e => setPåmTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full" />
                  <textarea value={påmNotering} onChange={e => setPåmNotering(e.target.value)} rows={2} placeholder="Vad ska kontrolleras?" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300" />
                  <div className="flex gap-2">
                    <button onClick={handleSparaPåminnelse} disabled={!påmDatum} className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Spara</button>
                    <button onClick={() => setVisaPåmForm(false)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                  </div>
                </div>
              )}
            </div>

            {/* Schemalagda åtgärder */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Schemalagda åtgärder</p>
                {!visaSchemaForm && (
                  <button onClick={() => setVisaSchemaForm(true)} className="text-[11px] text-violet-600 hover:text-violet-500">+ Lägg till</button>
                )}
              </div>

              {/* Formulär */}
              {visaSchemaForm && (
                <div className="flex flex-col gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select value={schTyp} onChange={e => setSchTyp(e.target.value as SchemaTyp)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                    {(Object.keys(SCHEMA_LABELS) as SchemaTyp[]).map(t => (
                      <option key={t} value={t}>{SCHEMA_IKONER[t]} {SCHEMA_LABELS[t]}</option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <input type="date" value={schDatum} onChange={e => setSchDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white flex-1" />
                    <input type="time" value={schTid} onChange={e => setSchTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-20" />
                  </div>
                  {(schTyp === 'svar' || schTyp === 'intern') && (
                    <textarea value={schText} onChange={e => setSchText(e.target.value)} rows={3}
                      placeholder={schTyp === 'svar' ? 'Meddelande till användaren...' : 'Intern anteckning...'}
                      className={`text-xs border rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none resize-none placeholder-slate-300 ${schTyp === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-200 focus:border-violet-400'}`}
                    />
                  )}
                  {schTyp === 'tilldela' && (
                    <>
                      <select value={schAgent} onChange={e => setSchAgent(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                        <option value="">Välj agent...</option>
                        {AGENTER.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <textarea value={schInstruktion} onChange={e => setSchInstruktion(e.target.value)} rows={2}
                        placeholder="Instruktion till agenten (valfritt)..." className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSpараSchema}
                      disabled={!schDatum || ((schTyp === 'svar' || schTyp === 'intern') ? !schText.trim() : !schAgent)}
                      className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Schemalägg
                    </button>
                    <button onClick={() => setVisaSchemaForm(false)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                  </div>
                </div>
              )}

              {/* Väntande */}
              {pendingSchema.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {pendingSchema.map(å => {
                    const isExpanded = expandedId === å.id
                    const isEditing  = editId === å.id
                    return (
                      <div key={å.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-1.5">
                        {/* Rubrikrad */}
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : å.id)}
                            className="text-xs font-medium text-slate-700 flex items-center gap-1 hover:text-slate-900 text-left"
                          >
                            <span>{SCHEMA_IKONER[å.typ]}</span>
                            <span>{dagText(å.schemasatt.datum)} kl {å.schemasatt.tid}</span>
                            <span className="text-slate-300 ml-0.5">{isExpanded ? '▴' : '▾'}</span>
                          </button>
                          <button onClick={() => onAvbrytSchema(arende.id, å.id)} className="text-slate-300 hover:text-red-400 text-sm leading-none transition-colors" title="Avbryt">✕</button>
                        </div>

                        {/* Kompakt förhandsvisning (inte expanded, inte editing) */}
                        {!isExpanded && !isEditing && (
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {å.typ === 'tilldela'
                              ? `→ ${å.tilldelaAgent}${å.instruktion ? ` · ${å.instruktion.slice(0, 50)}${å.instruktion.length > 50 ? '…' : ''}` : ''}`
                              : å.text ? `"${å.text.slice(0, 60)}${å.text.length > 60 ? '…' : ''}"` : ''}
                          </p>
                        )}

                        {/* Expanderad vy */}
                        {isExpanded && !isEditing && (
                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                            {å.typ === 'tilldela' ? (
                              <>
                                <p className="text-xs text-slate-600">→ <span className="font-medium">{å.tilldelaAgent}</span></p>
                                {å.instruktion && <p className="text-xs text-slate-500 leading-snug">{å.instruktion}</p>}
                              </>
                            ) : (
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{å.text}</p>
                            )}
                            <button
                              onClick={() => startEdit(å)}
                              className="text-[11px] text-violet-600 hover:text-violet-500 text-left"
                            >
                              Redigera
                            </button>
                          </div>
                        )}

                        {/* Redigera-vy */}
                        {isEditing && (
                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                            <div className="flex gap-1.5">
                              <input type="date" value={editDatum} onChange={e => setEditDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white flex-1" />
                              <input type="time" value={editTid} onChange={e => setEditTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-20" />
                            </div>
                            {(å.typ === 'svar' || å.typ === 'intern') && (
                              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                                className={`text-xs border rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none resize-none ${å.typ === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-200 focus:border-violet-400'}`}
                              />
                            )}
                            {å.typ === 'tilldela' && (
                              <>
                                <select value={editAgent} onChange={e => setEditAgent(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                                  <option value="">Välj agent...</option>
                                  {AGENTER.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <textarea value={editInstruktion} onChange={e => setEditInstruktion(e.target.value)} rows={2}
                                  placeholder="Instruktion (valfritt)..."
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300"
                                />
                              </>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => handleSparaEdit(å)} disabled={!editDatum} className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Spara</button>
                              <button onClick={() => setEditId(null)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Utförda */}
              {utfördaSchema.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] text-slate-300 uppercase tracking-wide">Utförda</p>
                  {utfördaSchema.map(å => (
                    <div key={å.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-green-400">✓</span>
                      <span>{SCHEMA_IKONER[å.typ]} {å.utförtTid}</span>
                    </div>
                  ))}
                </div>
              )}

              {pendingSchema.length === 0 && utfördaSchema.length === 0 && !visaSchemaForm && (
                <p className="text-xs text-slate-300">Inga schemalagda åtgärder.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

interface Props {
  onPendingNotiser?: (items: PendingNotis[]) => void
  defaultOpenId?:   string
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-violet-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 leading-tight">{label}</p>
    </div>
  )
}

export default function SupportInbox({ onPendingNotiser, defaultOpenId }: Props) {
  const [ärenden, setÄrenden]           = useState<ArendeAdmin[]>(() => executeOverdueActions(INITIAL_ÄRENDEN))
  const [öppetId, setÖppetId]           = useState<string | null>(defaultOpenId ?? null)
  const [statusFilter, setStatus]       = useState<ArendeStatus | ''>('')
  const [kategoriFilter, setKategori]   = useState('')
  const [tilldeladFilter, setTilldelad] = useState('')
  const [sortField, setSortField]       = useState<SortField>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('desc')
  const [sök, setSök]                   = useState('')

  const öppetÄrende = ärenden.find(a => a.id === öppetId) ?? null

  // Kontrollera overdue-åtgärder var 60:e sekund
  useEffect(() => {
    const check = () => setÄrenden(prev => executeOverdueActions(prev))
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  // Rapportera notiser uppåt
  useEffect(() => {
    if (!onPendingNotiser) return
    const now = new Date()
    const items: PendingNotis[] = []
    for (const a of ärenden) {
      if (a.påminnelse && (a.status === 'Öppet' || a.status === 'Under behandling')) {
        if (new Date(`${a.påminnelse.datum}T${a.påminnelse.tid}:00`) <= now)
          items.push({ arendeId: a.id, amne: a.amne, typ: 'påminnelse', notering: a.påminnelse.notering, sedan: `${a.påminnelse.datum} ${a.påminnelse.tid}` })
      }
      if (a.tilldelad === INLOGGAD_AGENT && (a.status === 'Öppet' || a.status === 'Under behandling'))
        items.push({ arendeId: a.id, amne: a.amne, typ: 'tilldelad', sedan: a.uppdaterat })
    }
    onPendingNotiser(items)
  }, [ärenden, onPendingNotiser])

  const totalt    = ärenden.length
  const öppna     = ärenden.filter(a => a.status === 'Öppet').length
  const pågående  = ärenden.filter(a => a.status === 'Under behandling').length
  const hanterade = ärenden.filter(a => a.status === 'Hanterat').length

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function handleSkicka(id: string, text: string, intern: boolean) {
    const tid = new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    setÄrenden(prev => prev.map(a => a.id !== id ? a : {
      ...a,
      status: !intern && a.status === 'Öppet' ? 'Under behandling' : a.status,
      uppdaterat: new Date().toISOString().split('T')[0],
      meddelanden: [...a.meddelanden, { fran: 'support' as const, text, tid, agentNamn: INLOGGAD_AGENT, ...(intern ? { intern: true } : {}) }],
    }))
  }

  function handleStatusChange(id: string, status: ArendeStatus) {
    setÄrenden(prev => prev.map(a => a.id === id ? { ...a, status, uppdaterat: new Date().toISOString().split('T')[0] } : a))
  }

  function handleTilldela(id: string, agent: string) {
    setÄrenden(prev => prev.map(a => a.id === id ? { ...a, tilldelad: agent || undefined } : a))
  }

  function handlePåminnelse(id: string, p: Påminnelse | undefined) {
    setÄrenden(prev => prev.map(a => a.id === id ? { ...a, påminnelse: p } : a))
  }

  function handleSchemalägg(arendeId: string, å: SchemalagdÅtgärd) {
    setÄrenden(prev => prev.map(a => a.id !== arendeId ? a : {
      ...a, schemalagda: [...(a.schemalagda ?? []), å],
    }))
  }

  function handleAvbrytSchema(arendeId: string, schemaId: string) {
    setÄrenden(prev => prev.map(a => a.id !== arendeId ? a : {
      ...a, schemalagda: (a.schemalagda ?? []).filter(å => å.id !== schemaId),
    }))
  }

  function handleUpdateSchema(arendeId: string, uppdaterad: SchemalagdÅtgärd) {
    setÄrenden(prev => prev.map(a => a.id !== arendeId ? a : {
      ...a, schemalagda: (a.schemalagda ?? []).map(å => å.id === uppdaterad.id ? uppdaterad : å),
    }))
  }

  const sökTerm = sök.trim().toLowerCase()
  const filtrerade = ärenden
    .filter(a => !statusFilter    || a.status    === statusFilter)
    .filter(a => !kategoriFilter  || a.kategori  === kategoriFilter)
    .filter(a => !tilldeladFilter || a.tilldelad === tilldeladFilter)
    .filter(a => !sökTerm || [a.amne, a.id, a.användare.namn, a.användare.epost].some(s => s.toLowerCase().includes(sökTerm)))
    .sort((a, b) => {
      if (!sortField) return 0
      let cmp = 0
      if (sortField === 'status')     cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      if (sortField === 'skapat')     cmp = a.skapat.localeCompare(b.skapat)
      if (sortField === 'uppdaterat') cmp = a.uppdaterat.localeCompare(b.uppdaterat)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const thCls = "py-3 text-xs font-medium text-slate-500 uppercase tracking-wide select-none"

  return (
    <div className="flex flex-col gap-6">

      <div className="grid grid-cols-4 gap-4">
        <StatChip label="Totalt antal ärenden" value={totalt}    color="text-slate-800" />
        <StatChip label="Öppna ärenden"        value={öppna}     color="text-blue-600"  />
        <StatChip label="Under behandling"     value={pågående}  color="text-amber-600" />
        <StatChip label="Hanterade ärenden"    value={hanterade} color="text-green-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
          <select value={statusFilter} onChange={e => setStatus(e.target.value as ArendeStatus | '')} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla statusar</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={kategoriFilter} onChange={e => setKategori(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla kategorier</option>
            {ALLA_KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={tilldeladFilter} onChange={e => setTilldelad(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla agenter</option>
            {AGENTER.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            value={sök} onChange={e => setSök(e.target.value)}
            placeholder="Sök ärende, användare..."
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-52 placeholder-slate-400"
          />
          <span className="ml-auto text-xs text-slate-400">{filtrerade.length} ärenden</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className={`pl-5 pr-3 w-28 ${thCls}`}>Ärende-ID</th>
                <th className={`px-4 ${thCls}`}>Ämne</th>
                <th className={`px-4 w-44 ${thCls}`}>Användare</th>
                <th className={`px-4 w-36 ${thCls}`}>Tilldelad</th>
                <th className={`px-4 w-16 ${thCls}`}>⏰</th>
                <th className={`px-4 w-44 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('status')}>Status <SortIcon active={sortField === 'status'} dir={sortDir} /></th>
                <th className={`px-4 w-24 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('skapat')}>Skapat <SortIcon active={sortField === 'skapat'} dir={sortDir} /></th>
                <th className={`pl-4 pr-5 w-28 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('uppdaterat')}>Uppdaterat <SortIcon active={sortField === 'uppdaterat'} dir={sortDir} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrerade.map(a => {
                const påmAktiv = a.påminnelse && isPåminnelseAktiv(a.påminnelse)
                const harSchema = (a.schemalagda ?? []).some(å => !å.utförd)
                return (
                  <tr key={a.id} onClick={() => setÖppetId(a.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                    <td className="pl-5 pr-3 py-4 font-mono text-xs text-slate-400">{a.id}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mb-1 inline-block">{a.kategori}</span>
                      <p className="text-slate-700 font-medium text-sm leading-snug">{a.amne}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-700">{a.användare.namn}</p>
                      <p className="text-xs text-slate-400">{a.användare.epost}</p>
                    </td>
                    <td className="px-4 py-4">
                      {a.tilldelad ? <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{a.tilldelad}</span> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center text-base">
                      {påmAktiv ? <span title="Förfallen påminnelse">🔴</span>
                        : a.påminnelse ? <span title={`Påminnelse ${a.påminnelse.datum} ${a.påminnelse.tid}`}>⏰</span>
                        : harSchema ? <span title="Schemalagd åtgärd">⏳</span>
                        : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap ${STATUS_CLS[a.status]}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-400">{a.skapat}</p>
                      {(a.status === 'Öppet' || a.status === 'Under behandling') && (() => {
                        const d = dagarSedan(a.skapat)
                        return <span className={`text-[11px] font-medium ${slaFärg(d)}`}>{d} d</span>
                      })()}
                    </td>
                    <td className="pl-4 pr-5 py-4 text-slate-400 text-xs">{a.uppdaterat}</td>
                  </tr>
                )
              })}
              {filtrerade.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Inga ärenden matchar filtret.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {öppetÄrende && (
        <ArendeModal
          arende={öppetÄrende}
          onClose={() => setÖppetId(null)}
          onSkicka={handleSkicka}
          onStatusChange={handleStatusChange}
          onTilldela={handleTilldela}
          onPåminnelse={handlePåminnelse}
          onSchemalägg={handleSchemalägg}
          onAvbrytSchema={handleAvbrytSchema}
          onUpdateSchema={handleUpdateSchema}
        />
      )}
    </div>
  )
}
