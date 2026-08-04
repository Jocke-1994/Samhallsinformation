import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { laddaSparadeHandelser, taBortSparadHandelse, type SparadHandelseMini } from '../../lib/sparadeHandelserStorage'
import { läggTillLoggpost } from '../../lib/aktivitetsloggStorage'
import { useAuth } from '../../context/AuthContext'
import { fetchAdminUsers, setAdminUserStatus, fetchUserNotifications, type AdminUserDto } from '../../api/adminUsers'
import type { PendingNotis } from '../../types/adminNotis'

// Mockad inloggad admin/support-identitet — samma placeholder som resten av
// admin-panelen (SupportInbox.INLOGGAD_AGENT, AdminPage-avataren)
const INLOGGAD_NAMN = 'Joakim Rehn'

type Roll = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status = 'Aktiv' | 'Inaktiv' | 'Avstängd'
export type DetaljFlik = 'oversikt' | 'notifinstallningar' | 'notishistorik' | 'aktivitet' | 'ärenden'
type ArendeStatusMini = 'Öppet' | 'Under behandling' | 'Hanterat' | 'Stängt'
interface ArendeMini { id: string; kategori: string; amne: string; status: ArendeStatusMini; skapat: string }
type RollÄndringTyp = 'ersätt' | 'lägg-till'
type Inloggningsmetod = 'E-post' | 'Google' | 'BankID'
type KontaktTyp = 'E-post' | 'SMS'

interface Kontaktuppgift {
  id:         number
  typ:        KontaktTyp
  värde:      string
  verifierad: boolean
  primär:     boolean
}

interface Användare {
  id:               string
  namn:             string
  epost:            string         // spegling av primär e-post, för tabellvisning
  roller:           Roll[]
  status:           Status
  registrerad:      string
  senastAktiv:      string
  paminnelseAt?:    string
  paminnelseNotering?: string
  inloggningsmetod: Inloggningsmetod
  kontaktuppgifter: Kontaktuppgift[]
}

interface NotisRad {
  tid:        string
  kanal:      KontaktTyp
  källa:      string
  rubrik:     string
  skickatTill: string
  status:     'Levererad' | 'Misslyckad' | 'Väntande'
  felorsak?:  string
}

interface AktivitetRad {
  tid:      string
  händelse: string
}

interface NotifKälla {
  källNamn:          string
  aktiv:             boolean
  kanaler:           KontaktTyp[]
  kontaktuppgiftIds: number[]      // vilka kontaktuppgifter som används per kanal
  geografier:        string[]
  kategorier:        string[]
}

// ---------------------------------------------------------------------------
// Mappning från riktig backend-data (GET /api/admin/users)
// ---------------------------------------------------------------------------

function normaliseraRoll(roll: string): Roll {
  return (['Admin', 'Support', 'Betatestare', 'Användare'] as const).includes(roll as Roll)
    ? roll as Roll
    : 'Användare'
}

function mapAdminUser(dto: AdminUserDto): Användare {
  return {
    id:               dto.id,
    namn:             dto.name,
    epost:            dto.email,
    roller:           [normaliseraRoll(dto.role)],
    status:           dto.isActive ? 'Aktiv' : 'Avstängd',
    registrerad:      new Date(dto.createdAt).toLocaleDateString('sv-SE'),
    senastAktiv:      '—', // ingen inloggningsspårning implementerad än
    paminnelseAt:       dto.suspensionReminderAt ? new Date(dto.suspensionReminderAt).toLocaleDateString('sv-SE') : undefined,
    paminnelseNotering: dto.suspensionReminderNote ?? undefined,
    inloggningsmetod: dto.authProvider === 'google' ? 'Google' : 'E-post',
    kontaktuppgifter: [
      { id: 1, typ: 'E-post', värde: dto.email, verifierad: true, primär: true },
    ],
  }
}

// ---------------------------------------------------------------------------
// Mock-data — detaljvyer (notiser/aktivitet/Polisen-filter/ärenden) har ingen
// backend-motsvarighet än, se `[[project_admin_anvandare]]`. Nycklarna nedan
// (1, 2, 3...) matchar inga riktiga användar-ID:n (nu riktiga GUID:er) — de
// visas därför bara som tomma "inget än"-lägen tills de kopplas mot riktig
// data i en framtida omgång, precis som Polisen-filter-vyn/supportärende-
// fliken redan var explicit undantagna från den här PR:en.
// ---------------------------------------------------------------------------

const MOCK_NOTISER: Record<string, NotisRad[]> = {
  3: [
    { tid: '2026-04-02 10:30', kanal: 'E-post', källa: 'Polisen', rubrik: 'Skottlossning, Norrköping',                   skickatTill: 'erik.l@gmail.com',  status: 'Levererad'  },
    { tid: '2026-04-01 18:15', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Explosion, Göteborg',                         skickatTill: '+46 76 345 67 89', status: 'Levererad'  },
    { tid: '2026-04-01 09:00', kanal: 'E-post', källa: 'SMHI',    rubrik: 'Klass 2-varning: hård vind, Västra Götaland', skickatTill: 'erik.l@gmail.com',  status: 'Levererad'  },
    { tid: '2026-03-30 14:42', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Bedrägeri via telefon, nationellt',            skickatTill: '+46 76 345 67 89', status: 'Misslyckad', felorsak: 'Leverantörsfel — timeout från SMS-gateway' },
    { tid: '2026-03-29 08:00', kanal: 'E-post', källa: 'MSB',     rubrik: 'Krisberedskapsinfo: övning Västkust',          skickatTill: 'erik@arbete.se',    status: 'Misslyckad', felorsak: 'E-postadressen är inte verifierad'          },
    { tid: '2026-03-28 12:00', kanal: 'E-post', källa: 'SMHI',    rubrik: 'Klass 1-varning: snö, Norrland',               skickatTill: 'erik.l@gmail.com',  status: 'Levererad'  },
  ],
  6: [
    { tid: '2026-04-02 11:00', kanal: 'E-post', källa: 'Polisen', rubrik: 'Rån, Göteborg',           skickatTill: 'sofia.n@gmail.com', status: 'Levererad' },
    { tid: '2026-04-01 22:30', kanal: 'SMS',    källa: 'Polisen', rubrik: 'Brand i lägenhet, Malmö', skickatTill: '+46 72 456 78 90', status: 'Väntande'  },
  ],
  1: [
    { tid: '2026-04-02 09:00', kanal: 'E-post', källa: 'Polisen', rubrik: 'Grovt brott, Stockholm',  skickatTill: 'joakim@work.se',    status: 'Levererad' },
    { tid: '2026-04-01 14:00', kanal: 'SMS',    källa: 'SMHI',    rubrik: 'Klass 3-varning: storm',  skickatTill: '+46 70 123 45 67', status: 'Levererad' },
    { tid: '2026-03-30 08:00', kanal: 'E-post', källa: 'MSB',     rubrik: 'Nationell övning SAMÖ',   skickatTill: 'joakim@example.com',status: 'Levererad' },
  ],
}

const MOCK_AKTIVITET: Record<string, AktivitetRad[]> = {
  3: [
    { tid: 'Idag 10:42',   händelse: 'Loggade in'                            },
    { tid: 'Idag 10:43',   händelse: 'Öppnade Polisen-källan'                },
    { tid: 'Igår 18:30',   händelse: 'Loggade in'                            },
    { tid: 'Igår 18:31',   händelse: 'Uppdaterade notifieringsinställningar' },
    { tid: '2026-03-30',   händelse: 'Lade till e-post erik@arbete.se'       },
    { tid: '2026-03-10',   händelse: 'Skapade konto'                         },
  ],
  6: [
    { tid: 'Idag 08:50',   händelse: 'Loggade in'                   },
    { tid: 'Igår 20:10',   händelse: 'Läste 4 artiklar från Polisen' },
    { tid: '2026-03-20',   händelse: 'Skapade konto'                 },
  ],
}

// Samma datastruktur som riktiga GET /api/user/polisen-filter (UserPolisenFilterController):
// null = ej anpassat (allt), en array = explicit valt urval (kan vara tom = matchar inget).
// Mockad tills det finns riktiga användare att lista (steg 4, #298).
interface PolisenFilterMini { kategorier: string[] | null; omraden: string[] | null }

const MOCK_POLISEN_FILTER: Record<string, PolisenFilterMini> = {
  3: { kategorier: ['Skottlossning', 'Explosion', 'Misshandel'], omraden: ['Norrköping', 'Göteborg'] },
  6: { kategorier: ['Rån', 'Brand'],                             omraden: ['Göteborg', 'Malmö']     },
  1: { kategorier: null,                                         omraden: null                       },
}

const MOCK_ÄRENDEN: Record<string, ArendeMini[]> = {
  2: [ // Anna Svensson
    { id: 'SUP-0031', kategori: 'Konto',          amne: 'Vill ta bort mitt konto',                         status: 'Hanterat',         skapat: '2026-03-01' },
  ],
  3: [ // Marcus Lindström
    { id: 'SUP-0038', kategori: 'Tekniskt fel',   amne: 'Källknappen för SMHI visas inte i menyn',         status: 'Öppet',            skapat: '2026-03-10' },
    { id: 'SUP-0024', kategori: 'Notifieringar',  amne: 'Vill ha notiser från fler regioner',              status: 'Stängt',           skapat: '2026-01-20' },
  ],
  4: [ // Emma Karlsson
    { id: 'SUP-0041', kategori: 'Konto',          amne: 'Kan inte byta lösenord, får felmeddelande',       status: 'Öppet',            skapat: '2026-03-18' },
    { id: 'SUP-0028', kategori: 'GDPR & uppgifter', amne: 'Fråga om GDPR och vilken data som sparas',     status: 'Stängt',           skapat: '2026-02-20' },
  ],
  5: [ // Peter Nilsson
    { id: 'SUP-0042', kategori: 'Notifieringar',  amne: 'Får inte notiser från Polisen trots att det är inställt', status: 'Under behandling', skapat: '2026-03-15' },
    { id: 'SUP-0019', kategori: 'Notifieringar',  amne: 'Notifieringar skickas vid fel tidpunkt',          status: 'Hanterat',         skapat: '2026-02-10' },
  ],
}

const ARENDE_STATUS_CLS: Record<ArendeStatusMini, string> = {
  'Öppet':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Hanterat':         'bg-green-50 text-green-700 border border-green-200',
  'Stängt':           'bg-slate-100 text-slate-500 border border-slate-200',
}

const MOCK_NOTIF: Record<string, NotifKälla[]> = {
  3: [
    { källNamn: 'Polisen',         aktiv: true,  kanaler: ['E-post', 'SMS'], kontaktuppgiftIds: [301, 303], geografier: ['Norrköping', 'Göteborg', 'Nationellt'], kategorier: ['Brott', 'Trafikhändelse']             },
    { källNamn: 'SMHI',            aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [301],       geografier: ['Västra Götaland', 'Nationellt'],        kategorier: ['Vädervarning']                        },
    { källNamn: 'MSB',             aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [302],       geografier: ['Nationellt'],                           kategorier: ['Krisberedskap']                       },
    { källNamn: 'Trafikverket',    aktiv: false, kanaler: [],                kontaktuppgiftIds: [],          geografier: [],                                       kategorier: []                                      },
    { källNamn: 'Krisinformation', aktiv: false, kanaler: [],                kontaktuppgiftIds: [],          geografier: [],                                       kategorier: []                                      },
  ],
  6: [
    { källNamn: 'Polisen',         aktiv: true,  kanaler: ['E-post', 'SMS'], kontaktuppgiftIds: [601, 602], geografier: ['Göteborg', 'Malmö'],                   kategorier: ['Brott']                               },
    { källNamn: 'SMHI',            aktiv: false, kanaler: [],                kontaktuppgiftIds: [],          geografier: [],                                       kategorier: []                                      },
    { källNamn: 'MSB',             aktiv: false, kanaler: [],                kontaktuppgiftIds: [],          geografier: [],                                       kategorier: []                                      },
    { källNamn: 'Trafikverket',    aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [601],       geografier: ['Göteborg'],                             kategorier: ['Trafikstörning', 'Vägarbete']         },
    { källNamn: 'Krisinformation', aktiv: false, kanaler: [],                kontaktuppgiftIds: [],          geografier: [],                                       kategorier: []                                      },
  ],
  1: [
    { källNamn: 'Polisen',         aktiv: true,  kanaler: ['E-post', 'SMS'], kontaktuppgiftIds: [102, 103], geografier: ['Nationellt'],                           kategorier: ['Brott', 'Trafikhändelse', 'Övrigt']   },
    { källNamn: 'SMHI',            aktiv: true,  kanaler: ['E-post', 'SMS'], kontaktuppgiftIds: [101, 103], geografier: ['Nationellt'],                           kategorier: ['Vädervarning']                        },
    { källNamn: 'MSB',             aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [101],       geografier: ['Nationellt'],                           kategorier: ['Krisberedskap']                       },
    { källNamn: 'Trafikverket',    aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [101],       geografier: ['Nationellt'],                           kategorier: ['Trafikstörning']                      },
    { källNamn: 'Krisinformation', aktiv: true,  kanaler: ['E-post'],        kontaktuppgiftIds: [101],       geografier: ['Nationellt'],                           kategorier: ['Krisberedskap', 'Samhällsinformation'] },
  ],
}

// ---------------------------------------------------------------------------
// Konstanter / hjälpare
// ---------------------------------------------------------------------------

const ALLA_ROLLER_LIST: Roll[] = ['Admin', 'Support', 'Betatestare', 'Användare']

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

const NOTIS_STATUS_CLS: Record<NotisRad['status'], string> = {
  'Levererad':  'bg-green-100 text-green-700 border border-green-200',
  'Misslyckad': 'bg-red-100 text-red-700 border border-red-200',
  'Väntande':   'bg-amber-100 text-amber-700 border border-amber-200',
}

const KANAL_CLS: Record<KontaktTyp, string> = {
  'E-post': 'bg-violet-100 text-violet-700',
  'SMS':    'bg-sky-100 text-sky-700',
}

const ALLA_ROLLER_FILTER: Array<Roll | 'Alla'> = ['Alla', 'Admin', 'Support', 'Betatestare', 'Användare']
const ALLA_STATUSAR: Array<Status | 'Alla'> = ['Alla', 'Aktiv', 'Inaktiv', 'Avstängd']

function initialer(namn: string) {
  return namn.split(' ').map(n => n[0]).join('').slice(0, 2)
}

// ---------------------------------------------------------------------------
// Modaler
// ---------------------------------------------------------------------------

function RollModal({ antal, initialRoller, onSpara, onStäng }: {
  antal: number
  initialRoller?: Roll[]
  onSpara: (roller: Roll[], typ: RollÄndringTyp) => void
  onStäng: () => void
}) {
  const [valda, setValda] = useState<Roll[]>(initialRoller ?? ['Användare'])
  const [typ, setTyp]     = useState<RollÄndringTyp>('ersätt')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Ändra roller</h2>
            <p className="text-violet-200 text-sm mt-0.5">{antal === 1 ? '1 användare' : `${antal} användare markerade`}</p>
          </div>
          <button onClick={onStäng} className="text-violet-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {antal > 1 && (
            <div className="flex gap-2">
              {(['ersätt', 'lägg-till'] as RollÄndringTyp[]).map(t => (
                <button key={t} onClick={() => setTyp(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    typ === t ? 'bg-violet-100 text-violet-700 border-violet-200' : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}>
                  {t === 'ersätt' ? 'Ersätt roller' : 'Lägg till roller'}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {ALLA_ROLLER_LIST.map(r => (
              <label key={r} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={valda.includes(r)}
                  onChange={() => setValda(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[r]}`}>{r}</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => { if (valda.length > 0) onSpara(valda, typ) }}
            disabled={valda.length === 0}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Applicera
          </button>
        </div>
      </div>
    </div>
  )
}

const PÅMINNELSE_VAL: { label: string; dagar: number | null }[] = [
  { label: '3 dagar',        dagar: 3    },
  { label: '1 vecka',        dagar: 7    },
  { label: '2 veckor',       dagar: 14   },
  { label: '1 månad',        dagar: 30   },
  { label: 'Ingen påminnelse', dagar: null },
]

function StängAvModal({ antal, onSpara, onStäng }: {
  antal: number
  onSpara: (anledning: string, paminnelseOm: number | null) => void
  onStäng: () => void
}) {
  const [anledning, setAnledning] = useState('')
  const [paminnelseDagar, setPaminnelseDagar] = useState<number | null>(7)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Stäng av konto</h2>
            <p className="text-amber-100 text-sm mt-0.5">{antal === 1 ? '1 användare' : `${antal} användare markerade`}</p>
          </div>
          <button onClick={onStäng} className="text-amber-200 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Anledning <span className="normal-case text-slate-400 font-normal">(frivillig, syns för andra admins)</span>
            </label>
            <textarea
              rows={3}
              value={anledning}
              onChange={e => setAnledning(e.target.value)}
              placeholder="T.ex. 'Missbrukade feedback-kanalen för spam'"
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none placeholder:text-slate-300"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Påminn mig om</label>
            <div className="grid grid-cols-2 gap-2">
              {PÅMINNELSE_VAL.map(v => (
                <button key={v.label} onClick={() => setPaminnelseDagar(v.dagar)}
                  className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                    v.dagar === paminnelseDagar
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
            {paminnelseDagar
              ? 'Kontot förblir avstängt tills en admin aktiverar det manuellt — men klockan i adminpanelen påminner om att titta på fallet igen.'
              : 'Kontot förblir avstängt tills en admin aktiverar det manuellt. Ingen påminnelse sätts.'}
          </p>
          <button onClick={() => onSpara(anledning, paminnelseDagar)}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors">
            Stäng av
          </button>
        </div>
      </div>
    </div>
  )
}

function RaderaModal({ antal, namn, onBekräfta, onStäng }: {
  antal: number
  namn?: string
  onBekräfta: () => void
  onStäng: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Radera konto</h2>
            <p className="text-red-200 text-sm mt-0.5">{namn ?? `${antal} användare markerade`}</p>
          </div>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">All användardata raderas permanent i enlighet med GDPR artikel 17. Åtgärden kan inte ångras.</p>
          <div className="flex gap-3">
            <button onClick={onStäng} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={onBekräfta} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">Radera permanent</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImpersonationModal({ användare, onBekräfta, onStäng }: {
  användare: Användare
  onBekräfta: (kommentar: string) => void
  onStäng: () => void
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
              {användare.namn.split(' ').map(n => n[0]).join('').slice(0, 2)}
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

interface AnvandareProps {
  onÖppnaÄrende?:     (arendeId: string) => void
  defaultÖppnaEpost?: string
  defaultFlik?:       DetaljFlik
  onPendingNotiser?:  (items: PendingNotis[]) => void
}

export default function Anvandare({ onÖppnaÄrende, defaultÖppnaEpost, defaultFlik, onPendingNotiser }: AnvandareProps) {
  const { aktivVy } = useAuth()
  const { data: adminUsers, isLoading: laddar, isError: laddningFel, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  fetchAdminUsers,
  })
  const [användare, setAnvändare]               = useState<Användare[]>([])
  const [rollFilter, setRollFilter]             = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter]         = useState<Status | 'Alla'>('Alla')
  const [sökning, setSökning]                   = useState('')
  const [vald, setVald]                         = useState<Användare | null>(null)
  const [detaljFlik, setDetaljFlik]             = useState<DetaljFlik>('oversikt')
  const [markerade, setMarkerade]               = useState<Set<string>>(new Set())
  const [modal, setModal]                       = useState<'roller' | 'stäng-av' | 'radera' | null>(null)
  const [enkildStängAv, setEnkildStängAv]       = useState<Användare | null>(null)
  const [enkildRadera, setEnkildRadera]         = useState<Användare | null>(null)
  const [enkildRollÄndring, setEnkildRollÄndring] = useState<Användare | null>(null)
  const [impersonationMål, setImpersonationMål]   = useState<Användare | null>(null)
  const [sparadeHändelser, setSparadeHändelser]   = useState<SparadHandelseMini[]>([])

  const filtrerade = användare.filter(u => {
    if (rollFilter !== 'Alla' && !u.roller.includes(rollFilter)) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (sökning && !u.namn.toLowerCase().includes(sökning.toLowerCase()) &&
        !u.epost.toLowerCase().includes(sökning.toLowerCase()) &&
        !String(u.id).includes(sökning)) return false
    return true
  })

  function toggleMarkerad(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setMarkerade(prev => { const ny = new Set(prev); ny.has(id) ? ny.delete(id) : ny.add(id); return ny })
  }

  function toggleAllaMarkerade() {
    setMarkerade(prev => prev.size === filtrerade.length ? new Set() : new Set(filtrerade.map(u => u.id)))
  }

  useEffect(() => {
    if (adminUsers) setAnvändare(adminUsers.map(mapAdminUser))
  }, [adminUsers])

  const { data: kontoNotiser = [] } = useQuery({
    queryKey: ['user-notifications'],
    queryFn:  fetchUserNotifications,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!onPendingNotiser) return
    onPendingNotiser(kontoNotiser.map(n => ({
      arendeId: n.userId, amne: n.namn, typ: 'kontospärrning' as const, notering: n.notering, epost: n.epost,
    })))
  }, [kontoNotiser, onPendingNotiser])

  useEffect(() => {
    if (!defaultÖppnaEpost) return
    const u = användare.find(x => x.epost === defaultÖppnaEpost)
    if (u) {
      setVald(u)
      setDetaljFlik(defaultFlik ?? 'notifinstallningar')
      // Sparat-lagringen (lib/sparadeHandelserStorage.ts) är fortfarande
      // nyckad på gamla mock-numeriska ID:n (delad med Händelsesök/
      // Aktivitetslogg, ej del av den här PR:ns scope) — riktiga GUID-ID:n
      // matchar aldrig något, `Number(u.id)` blir NaN och ger alltid tomt.
      setSparadeHändelser(laddaSparadeHandelser()[Number(u.id)] ?? [])
    }
  }, [defaultÖppnaEpost, defaultFlik, användare])

  function öppnaDetalj(u: Användare) {
    setVald(u)
    setDetaljFlik('oversikt')
    setSparadeHändelser(laddaSparadeHandelser()[Number(u.id)] ?? [])
  }

  function taBortSparad(eventId: string) {
    if (!vald) return
    const handelse = sparadeHändelser.find(h => h.eventId === eventId)
    taBortSparadHandelse(Number(vald.id), eventId)
    setSparadeHändelser(prev => prev.filter(h => h.eventId !== eventId))
    if (handelse) {
      läggTillLoggpost({
        tid:    new Date().toISOString(),
        vem:    `${INLOGGAD_NAMN} (${aktivVy}-läge)`,
        typ:    'Sparat: borttagen',
        rubrik: `Tog bort sparad händelse från ${vald.namn}`,
        detalj: `"${handelse.title}" (${handelse.sourceName}) borttagen från ${vald.namn}s konto.`,
        ångraData: { anvandareId: Number(vald.id), handelse, undoAction: 'lägg-till' },
      })
    }
  }

  function applicerapRoller(roller: Roll[], typ: RollÄndringTyp) {
    setAnvändare(prev => prev.map(u => {
      if (!markerade.has(u.id)) return u
      const nyaRoller = typ === 'ersätt' ? roller : Array.from(new Set([...u.roller, ...roller]))
      return { ...u, roller: nyaRoller }
    }))
    setMarkerade(new Set()); setModal(null)
  }

  function applicerapRollerEnkild(u: Användare, roller: Roll[]) {
    setAnvändare(prev => prev.map(x => x.id === u.id ? { ...x, roller } : x))
    setVald(prev => prev?.id === u.id ? { ...prev, roller } : prev)
    setEnkildRollÄndring(null)
  }

  function beräknaPåminnelse(dagar: number | null): string | null {
    if (dagar === null) return null
    const d = new Date()
    d.setDate(d.getDate() + dagar)
    return d.toISOString()
  }

  async function stängAv(anledning: string, påminnelseOm: number | null) {
    const reminderAt = beräknaPåminnelse(påminnelseOm)
    await Promise.all([...markerade].map(id => setAdminUserStatus(id, false, anledning || undefined, reminderAt)))
    await refetch()
    setMarkerade(new Set()); setModal(null)
  }

  function raderaMarkerade() {
    // Inget backend-stöd för att radera konton än (#299, GDPR-export/radering)
    // — bulk-raderaknappen är avsiktligt inaktiverad, se knappens title-attribut.
  }

  async function stängAvEnkild(u: Användare, anledning: string, påminnelseOm: number | null) {
    await setAdminUserStatus(u.id, false, anledning || undefined, beräknaPåminnelse(påminnelseOm))
    await refetch()
    setEnkildStängAv(null)
  }

  async function aktiveraEnkild(u: Användare) {
    await setAdminUserStatus(u.id, true)
    await refetch()
  }

  const antal = {
    totalt:      användare.length,
    aktiva:      användare.filter(u => u.status === 'Aktiv').length,
    betatestare: användare.filter(u => u.roller.includes('Betatestare')).length,
    avstängda:   användare.filter(u => u.status === 'Avstängd').length,
  }

  const allaMarkerade = filtrerade.length > 0 && markerade.size === filtrerade.length


  const harOverifierad = (u: Användare) => u.kontaktuppgifter.some(k => !k.verifierad)

  return (
    <div className="flex flex-col gap-6">

      {/* Modaler — bulk */}
      {modal === 'roller'   && <RollModal antal={markerade.size} onSpara={applicerapRoller} onStäng={() => setModal(null)} />}
      {modal === 'stäng-av' && <StängAvModal antal={markerade.size} onSpara={stängAv} onStäng={() => setModal(null)} />}
      {modal === 'radera'   && <RaderaModal antal={markerade.size} onBekräfta={raderaMarkerade} onStäng={() => setModal(null)} />}

      {/* Modaler — enskild */}
      {enkildRollÄndring && (
        <RollModal antal={1} initialRoller={enkildRollÄndring.roller}
          onSpara={(roller) => applicerapRollerEnkild(enkildRollÄndring, roller)}
          onStäng={() => setEnkildRollÄndring(null)} />
      )}
      {enkildStängAv && (
        <StängAvModal antal={1} onSpara={(anledning, påminnelseOm) => stängAvEnkild(enkildStängAv, anledning, påminnelseOm)} onStäng={() => setEnkildStängAv(null)} />
      )}
      {impersonationMål && (
        <ImpersonationModal
          användare={impersonationMål}
          onBekräfta={(_kommentar) => {
            window.open(`/?impersonating=${impersonationMål.id}&namn=${encodeURIComponent(impersonationMål.namn)}`, '_blank')
            setImpersonationMål(null)
          }}
          onStäng={() => setImpersonationMål(null)}
        />
      )}
      {enkildRadera && (
        <RaderaModal antal={1} namn={enkildRadera.namn} onBekräfta={() => {
          setAnvändare(prev => prev.filter(u => u.id !== enkildRadera.id))
          if (vald?.id === enkildRadera.id) setVald(null)
          setEnkildRadera(null)
        }} onStäng={() => setEnkildRadera(null)} />
      )}

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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap min-h-[60px]">
          {markerade.size > 0 ? (
            <>
              <span className="text-sm font-medium text-violet-700">{markerade.size} markerade</span>
              <div className="flex gap-2 ml-auto">
                <button disabled title="Inte kopplat mot backend än — ingen endpoint för att ändra roll"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed">Ändra roller</button>
                <button onClick={() => setModal('stäng-av')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">Stäng av</button>
                <button disabled title="Inte kopplat mot backend än — ingen endpoint för att radera konton (#299)"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-100 text-red-300 cursor-not-allowed">Radera</button>
                <button onClick={() => setMarkerade(new Set())} className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">✕ Avmarkera</button>
              </div>
            </>
          ) : (
            <>
              <input type="text" placeholder="Sök namn, e-post eller ID..." value={sökning}
                onChange={e => setSökning(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-60" />
              <div className="flex gap-1 ml-auto">
                {ALLA_ROLLER_FILTER.map(r => (
                  <button key={r} onClick={() => setRollFilter(r)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>{r}</button>
                ))}
              </div>
              <div className="flex gap-1">
                {ALLA_STATUSAR.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}>{s}</button>
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
              <th className="text-left px-2 py-3 font-medium w-10">ID</th>
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
                onClick={() => öppnaDetalj(u)}>
                <td className="px-6 py-3" onClick={e => toggleMarkerad(e, u.id)}>
                  <input type="checkbox" checked={markerade.has(u.id)} readOnly
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                </td>
                <td className="px-2 py-3 text-xs text-slate-400 font-mono">#{u.id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">{initialer(u.namn)}</div>
                    <div>
                      <p className="font-medium text-slate-800">{u.namn}</p>
                      <p className="text-xs text-slate-400">{u.epost}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roller.map(r => <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLL_CLS[r]}`}>{r}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[u.status]}`}>{u.status}</span>
                    </div>
                    {u.paminnelseAt && <p className="text-xs text-amber-500 pl-4">⏰ påminnelse {u.paminnelseAt}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.registrerad}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.senastAktiv}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors whitespace-nowrap">Detaljer →</button>
                </td>
              </tr>
            ))}
            {laddar && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">Laddar användare…</td></tr>
            )}
            {laddningFel && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-red-500">Kunde inte hämta användarlistan. Försök ladda om sidan.</td></tr>
            )}
            {!laddar && !laddningFel && filtrerade.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">Inga användare matchar filtret.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detaljpanel — backdrop */}
      {vald && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setVald(null)} />
      )}

      {/* Detaljpanel — slide-in från höger */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 w-[700px] bg-white shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 ease-out ${vald ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ pointerEvents: vald ? 'auto' : 'none' }}
      >
      {vald && (
        <div className="flex flex-col flex-1">

          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">{initialer(vald.namn)}</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{vald.namn}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLS[vald.status]}`}>{vald.status}</span>
                  {harOverifierad(vald) && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Overifierad kontaktuppgift</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{vald.epost} · ID #{vald.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setImpersonationMål(vald)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">Logga in som</button>
              <button onClick={() => setVald(null)} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
            </div>
          </div>

          {/* Flikar */}
          <div className="flex border-b border-slate-100 px-6">
            {([
              { id: 'oversikt',           label: 'Översikt'                  },
              { id: 'notifinstallningar', label: 'Notifieringsinställningar'  },
              { id: 'notishistorik',      label: 'Notishistorik'             },
              { id: 'aktivitet',          label: 'Aktivitet'                 },
              { id: 'ärenden',            label: 'Supportärenden'            },
            ] as { id: DetaljFlik; label: string }[]).map(f => (
              <button key={f.id} onClick={() => setDetaljFlik(f.id)}
                className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors ${
                  detaljFlik === f.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Översikt ── */}
          {detaljFlik === 'oversikt' && (
            <div className="px-6 py-5 grid grid-cols-2 gap-8">

              <div className="flex flex-col gap-5">

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Roller</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vald.roller.map(r => <span key={r} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[r]}`}>{r}</span>)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Registrerad</p>
                    <p className="text-sm text-slate-700">{vald.registrerad}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Senast aktiv</p>
                    <p className="text-sm text-slate-700">{vald.senastAktiv}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Inloggningsmetod</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INLOGGNING_CLS[vald.inloggningsmetod]}`}>{vald.inloggningsmetod}</span>
                </div>

                {/* Kontaktuppgifter */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Kontaktuppgifter</p>
                  <div className="flex flex-col gap-2">
                    {vald.kontaktuppgifter.map(k => (
                      <div key={k.id} className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[k.typ]}`}>{k.typ}</span>
                        <span className="text-sm text-slate-700">{k.värde}</span>
                        {k.primär && <span className="text-xs text-slate-400 font-medium">Primär</span>}
                        <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${k.verifierad ? 'bg-green-500' : 'bg-amber-400'}`} title={k.verifierad ? 'Verifierad' : 'Ej verifierad'} />
                        {!k.verifierad && <span className="text-xs text-amber-600">Ej verifierad</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Polisen-filter (FAS 4, #298) — mockad tills riktiga användare finns, se
                    MOCK_POLISEN_FILTER-kommentaren för datastrukturen som redan är på riktigt */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Polisen-filter</p>
                  {(() => {
                    const filter = MOCK_POLISEN_FILTER[vald.id]
                    if (!filter) return <p className="text-sm text-slate-400">Följer inte Polisen som källa.</p>
                    if (filter.kategorier === null && filter.omraden === null)
                      return <p className="text-sm text-slate-500">Inget anpassat filter — får allt från Polisen.</p>
                    return (
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Typer</p>
                          <div className="flex flex-wrap gap-1">
                            {(filter.kategorier ?? []).length > 0
                              ? filter.kategorier!.map(k => <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{k}</span>)
                              : <span className="text-xs text-slate-400">Alla</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Områden</p>
                          <div className="flex flex-wrap gap-1">
                            {(filter.omraden ?? []).length > 0
                              ? filter.omraden!.map(o => <span key={o} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{o}</span>)
                              : <span className="text-xs text-slate-400">Alla</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Sparat (#298, punkt 9) — mockad via delad localStorage-modul
                    (sparadeHandelserStorage.ts), skrivs från Händelsesök */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Sparat</p>
                  {sparadeHändelser.length === 0 ? (
                    <p className="text-sm text-slate-400">Inga sparade händelser.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sparadeHändelser.map(h => (
                        <div key={h.eventId} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="text-slate-700 truncate">{h.title}</p>
                            <p className="text-xs text-slate-400">{h.sourceName} · sparad {h.sparadDatum}</p>
                          </div>
                          <button
                            onClick={() => taBortSparad(h.eventId)}
                            className="shrink-0 text-xs text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Ta bort
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {vald.paminnelseAt && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-amber-700">⏰ Påminnelse satt till {vald.paminnelseAt}</p>
                    {vald.paminnelseNotering && <p className="text-xs text-amber-600 mt-0.5">{vald.paminnelseNotering}</p>}
                    <p className="text-xs text-amber-600 mt-0.5">Kontot återaktiveras inte automatiskt — det här är bara en påminnelse att titta på fallet igen.</p>
                  </div>
                )}

              </div>

              {/* Åtgärder */}
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Åtgärder</p>
                <button disabled title="Inte kopplat mot backend än — ingen endpoint för att ändra roll"
                  className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-300 cursor-not-allowed">
                  Ändra roller
                </button>
                <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  Skicka lösenordsåterställning
                </button>
                {vald.kontaktuppgifter.some(k => !k.verifierad) && (
                  <button className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                    Skicka verifieringsmail
                  </button>
                )}
                {vald.status === 'Avstängd' ? (
                  <button onClick={() => aktiveraEnkild(vald)}
                    className="text-left px-4 py-2.5 rounded-xl border border-green-200 text-sm text-green-700 hover:bg-green-50 transition-colors">
                    Aktivera konto
                  </button>
                ) : (
                  <button onClick={() => setEnkildStängAv(vald)}
                    className="text-left px-4 py-2.5 rounded-xl border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                    Stäng av konto
                  </button>
                )}
                <button disabled title="Inte kopplat mot backend än — ingen endpoint för att radera konton (#299)"
                  className="text-left px-4 py-2.5 rounded-xl border border-red-100 text-red-300 cursor-not-allowed">
                  Radera konto (GDPR)
                </button>
              </div>

            </div>
          )}

          {/* ── Notifieringsinställningar ── */}
          {detaljFlik === 'notifinstallningar' && (
            <div className="px-6 py-5">
              {!(MOCK_NOTIF[vald.id]?.some(k => k.aktiv)) ? (
                <p className="text-center text-sm text-slate-400 py-10">Användaren har inga aktiva notifieringar.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {(MOCK_NOTIF[vald.id] ?? []).map(k => (
                    <div key={k.källNamn} className={`rounded-xl border px-5 py-4 ${k.aktiv ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${k.aktiv ? 'bg-green-500' : 'bg-slate-300'}`} />
                          <p className="text-sm font-semibold text-slate-800">{k.källNamn}</p>
                        </div>
                        <div className="flex gap-1">
                          {k.kanaler.map(kanal => (
                            <span key={kanal} className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[kanal]}`}>{kanal}</span>
                          ))}
                        </div>
                      </div>
                      {k.aktiv && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">Skickas till</p>
                            <div className="flex flex-col gap-1">
                              {k.kontaktuppgiftIds.map(kid => {
                                const ku = vald.kontaktuppgifter.find(x => x.id === kid)
                                if (!ku) return null
                                return (
                                  <div key={kid} className="flex items-center gap-1.5">
                                    <span className={`text-xs font-medium px-1.5 py-0 rounded-full ${KANAL_CLS[ku.typ]}`}>{ku.typ}</span>
                                    <span className="text-xs text-slate-600 truncate">{ku.värde}</span>
                                    {!ku.verifierad && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ej verifierad" />}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">Geografier</p>
                            <div className="flex flex-wrap gap-1">
                              {k.geografier.length > 0
                                ? k.geografier.map(g => <span key={g} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{g}</span>)
                                : <span className="text-xs text-slate-400">Alla</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">Kategorier</p>
                            <div className="flex flex-wrap gap-1">
                              {k.kategorier.length > 0
                                ? k.kategorier.map(kat => <span key={kat} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{kat}</span>)
                                : <span className="text-xs text-slate-400">Alla</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Notishistorik ── */}
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
                      <th className="text-left px-4 py-3 font-medium">Skickat till</th>
                      <th className="text-left px-4 py-3 font-medium">Källa</th>
                      <th className="text-left px-4 py-3 font-medium">Rubrik</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MOCK_NOTISER[vald.id].map((n, i) => (
                      <>
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">{n.tid}</td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[n.kanal]}`}>{n.kanal}</span></td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{n.skickatTill}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{n.källa}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{n.rubrik}</td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${NOTIS_STATUS_CLS[n.status]}`}>{n.status}</span></td>
                        </tr>
                        {n.felorsak && (
                          <tr key={`${i}-fel`} className="bg-red-50">
                            <td colSpan={6} className="px-6 py-2 text-xs text-red-600">
                              <span className="font-medium">Felorsak:</span> {n.felorsak}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Supportärenden ── */}
          {detaljFlik === 'ärenden' && (
            <div>
              {(MOCK_ÄRENDEN[vald.id] ?? []).length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-400">Inga supportärenden kopplade till den här användaren.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">Ärende-ID</th>
                      <th className="text-left px-4 py-3 font-medium">Kategori</th>
                      <th className="text-left px-4 py-3 font-medium">Ämne</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Skapat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MOCK_ÄRENDEN[vald.id].map(a => (
                      <tr
                        key={a.id}
                        onClick={() => onÖppnaÄrende?.(a.id)}
                        className={`hover:bg-slate-50 transition-colors ${onÖppnaÄrende ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-6 py-3 font-mono text-xs text-slate-400">{a.id}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full">{a.kategori}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{a.amne}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ARENDE_STATUS_CLS[a.status]}`}>{a.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{a.skapat}</td>
                        {onÖppnaÄrende && <td className="pr-4 py-3 text-right text-xs text-violet-600">Öppna →</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Aktivitet ── */}
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

    </div>
  )
}
