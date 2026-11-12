import { useState, useEffect, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createActivityLogEntry } from '../../api/activityLog'
import { useAuth } from '../../context/AuthContext'
import { effektivAdminRoll } from '../../lib/adminNavigering'
import {
  fetchAdminUsers,
  setAdminUserStatus,
  deleteAdminUser,
  cancelUserDeletion,
  fetchAdminUserSavedEvents,
  unsaveAdminUserEvent,
  fetchAdminUserPolisenBevakningar,
  fetchAdminUserNotificationLog,
  fetchAdminUserSettingLog,
  type AdminUserDto,
  createAdminUserPolisenBevakning,
  updateAdminUserPolisenBevakning,
  deleteAdminUserPolisenBevakning,
  fetchAdminUserSources,
  setAdminUserSourceActive,
  type AdminPolisenBevakningDto,
  sendAdminUserPasswordReset,
  resendAdminUserVerification,
  fetchAdminUserPushSettings,
  setAdminUserPushSettings,
  explainAdminUserEvent,
  type AdminExplainEventDto,
} from '../../api/adminUsers'
import { fetchAdminTickets, type AdminTicketListItemDto } from '../../api/support'
import { checkEventLinkStatus } from '../../api/events'
import { searchEvents, type AdminSearchEvent } from '../../api/eventSearch'
import KategoriFilterModal from '../Profile/MinaKallor/KategoriFilterModal'
import { IngetKopplatAn } from '../common/MockBadge'
import { HamtningsFel, MutationFel } from '../common/HamtningsStatus'
import { visaFel } from '../../lib/felmeddelande'

type Roll = 'Admin' | 'Support' | 'Betatestare' | 'Användare'
type Status = 'Aktiv' | 'Inaktiv' | 'Avstängd' | 'Raderas snart' | 'Raderat'
export type DetaljFlik =
  | 'oversikt'
  | 'notifinstallningar'
  | 'notishistorik'
  | 'installningshistorik'
  | 'aktivitet'
  | 'ärenden'
type ArendeStatusMini = 'Öppet' | 'Under behandling' | 'Hanterat' | 'Stängt'
type RollÄndringTyp = 'ersätt' | 'lägg-till'
type Inloggningsmetod = 'E-post' | 'Google' | 'BankID'
type KontaktTyp = 'E-post' | 'SMS'

interface Kontaktuppgift {
  id: number
  typ: KontaktTyp
  värde: string
  verifierad: boolean
  primär: boolean
}

interface Användare {
  id: string
  joinNr: number // visningsnummer baserat på registreringsordning, inte kopplat till GUID:et
  namn: string
  epost: string // spegling av primär e-post, för tabellvisning
  roller: Roll[]
  status: Status
  registrerad: string
  senastAktiv: string
  paminnelseAt?: string
  paminnelseNotering?: string
  raderasVid?: string
  inloggningsmetod: Inloggningsmetod
  kontaktuppgifter: Kontaktuppgift[]
}

// ---------------------------------------------------------------------------
// Mappning från riktig backend-data (GET /api/admin/users)
// ---------------------------------------------------------------------------

function normaliseraRoll(roll: string): Roll {
  return (['Admin', 'Support', 'Betatestare', 'Användare'] as const).includes(roll as Roll)
    ? (roll as Roll)
    : 'Användare'
}

// Kontot fanns innan CreatedAt-kolumnen fanns — den migrationen (Program.cs,
// AddUserSystem) backfyllde befintliga rader med literalen 0001-01-01
// istället för deras faktiska (aldrig sparade) registreringsdatum. Ärligare
// att visa "Okänt" än att låtsas veta ett datum som aldrig fanns.
function formatRegistreringsdatum(iso: string): string {
  const d = new Date(iso)
  return d.getFullYear() < 2000 ? 'Okänt' : d.toLocaleDateString('sv-SE')
}

function mapAdminUser(dto: AdminUserDto, joinNr: number): Användare {
  return {
    id: dto.id,
    joinNr,
    namn: dto.name,
    epost: dto.email,
    roller: [normaliseraRoll(dto.role)],
    status: dto.deletedAt
      ? 'Raderat'
      : dto.deletionScheduledAt
        ? 'Raderas snart'
        : dto.isActive
          ? 'Aktiv'
          : 'Avstängd',
    registrerad: formatRegistreringsdatum(dto.createdAt),
    senastAktiv: '—', // ingen inloggningsspårning implementerad än
    paminnelseAt: dto.suspensionReminderAt
      ? new Date(dto.suspensionReminderAt).toLocaleDateString('sv-SE')
      : undefined,
    paminnelseNotering: dto.suspensionReminderNote ?? undefined,
    raderasVid: dto.deletionScheduledAt
      ? new Date(dto.deletionScheduledAt).toLocaleString('sv-SE')
      : undefined,
    inloggningsmetod: dto.authProvider === 'google' ? 'Google' : 'E-post',
    kontaktuppgifter: [{ id: 1, typ: 'E-post', värde: dto.email, verifierad: true, primär: true }],
  }
}

function ticketNr(t: AdminTicketListItemDto): string {
  return `SUP-${String(t.ticketNumber).padStart(4, '0')}`
}

const ARENDE_STATUS_CLS: Record<ArendeStatusMini, string> = {
  Öppet: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  Hanterat: 'bg-green-50 text-green-700 border border-green-200',
  Stängt: 'bg-slate-100 text-slate-500 border border-slate-200',
}

// ---------------------------------------------------------------------------
// Konstanter / hjälpare
// ---------------------------------------------------------------------------

const ALLA_ROLLER_LIST: Roll[] = ['Admin', 'Support', 'Betatestare', 'Användare']

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
  'Raderas snart': 'bg-red-50 text-red-500 border border-red-200',
  Raderat: 'bg-slate-200 text-slate-500 border border-slate-300',
}

const STATUS_DOT: Record<Status, string> = {
  Aktiv: 'bg-green-500',
  Inaktiv: 'bg-slate-300',
  Avstängd: 'bg-red-500',
  'Raderas snart': 'bg-red-400',
  Raderat: 'bg-slate-400',
}

const INLOGGNING_CLS: Record<Inloggningsmetod, string> = {
  'E-post': 'bg-slate-100 text-slate-600 border border-slate-200',
  Google: 'bg-blue-100 text-blue-700 border border-blue-200',
  BankID: 'bg-sky-100 text-sky-700 border border-sky-200',
}

const KANAL_CLS: Record<KontaktTyp, string> = {
  'E-post': 'bg-violet-100 text-violet-700',
  SMS: 'bg-sky-100 text-sky-700',
}

// Notishistorik-fliken (GET /api/admin/users/{id}/notification-log) —
// riktiga statusar/kanaler från NotificationDeliveryLog/PushDispatcher.cs,
// inte samma värdemängd som KANAL_CLS/kontaktuppgifter (push idag, ingen
// e-post/SMS-leverans byggd än).
const NOTIF_LOG_STATUS_LABEL: Record<string, string> = {
  sent: 'Levererad',
  failed: 'Misslyckad',
  expired: 'Utgången',
}

const NOTIF_LOG_STATUS_CLS: Record<string, string> = {
  sent: 'bg-green-100 text-green-700 border border-green-200',
  failed: 'bg-red-100 text-red-700 border border-red-200',
  expired: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const NOTIF_LOG_STATUS_FALLBACK_CLS = 'bg-slate-100 text-slate-600 border border-slate-200'

const NOTIF_LOG_CHANNEL_LABEL: Record<string, string> = { push: 'Push' }

const SETTING_LABEL: Record<string, string> = {
  password: 'Lösenord',
  email: 'E-postadress',
  name: 'Namn',
  displayName: 'Visningsnamn',
  account_deletion_requested: 'Kontoradering begärd (GDPR)',
  data_export: 'GDPR-export nedladdad',
  polisen_bevakning_skapad: 'Polisen-bevakning skapad',
  polisen_bevakning_ändrad: 'Polisen-bevakning ändrad',
  polisen_bevakning_borttagen: 'Polisen-bevakning borttagen',
  push_enabled: 'Push (globalt) på/av',
  push_nya_handelser: 'Push · Ny händelse på/av',
  push_ny_version: 'Push · Ny version på/av',
}
const NOTIF_LOG_CHANNEL_CLS: Record<string, string> = { push: 'bg-sky-100 text-sky-700' }
const NOTIF_LOG_CHANNEL_FALLBACK_CLS = 'bg-slate-100 text-slate-600'

function förkortaMottagare(recipient: string): string {
  return recipient.length > 40 ? `${recipient.slice(0, 40)}…` : recipient
}

const ALLA_ROLLER_FILTER: Array<Roll | 'Alla'> = [
  'Alla',
  'Admin',
  'Support',
  'Betatestare',
  'Användare',
]
const ALLA_STATUSAR: Array<Status | 'Alla'> = [
  'Alla',
  'Aktiv',
  'Inaktiv',
  'Avstängd',
  'Raderas snart',
  'Raderat',
]

function initialer(namn: string) {
  return namn
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Resultat av en massåtgärd (V2-3): per-rad-utfall i stället för "allt eller inget"
// ---------------------------------------------------------------------------

interface MassResultat {
  totalt: number
  fel: { id: string; namn: string; orsak: string }[]
}

function felOrsak(orsak: unknown): string {
  return orsak instanceof Error && orsak.message ? orsak.message : 'Något gick fel'
}

function MassResultatVy({ resultat, onStäng }: { resultat: MassResultat; onStäng: () => void }) {
  const lyckade = resultat.totalt - resultat.fel.length
  return (
    <div className="px-6 py-5 flex flex-col gap-4" data-testid="mass-resultat">
      <p className="text-sm font-medium text-slate-700">
        {lyckade} av {resultat.totalt} lyckades.
      </p>
      {resultat.fel.length > 0 && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
          <p className="font-medium">Misslyckades:</p>
          <ul className="flex flex-col gap-1">
            {resultat.fel.map((f) => (
              <li key={f.id}>
                {f.namn} — {f.orsak}
              </li>
            ))}
          </ul>
        </div>
      )}
      {resultat.fel.length > 0 && (
        <p className="text-xs text-slate-500">
          De som misslyckades är fortfarande markerade i listan.
        </p>
      )}
      <button
        onClick={onStäng}
        className="w-full py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
      >
        Stäng
      </button>
    </div>
  )
}

/** Första ~5 namnen, sedan "och N till". */
function namnSammanfattning(namn: string[], max = 5): string {
  if (namn.length <= max) return namn.join(', ')
  return `${namn.slice(0, max).join(', ')} och ${namn.length - max} till`
}

// ---------------------------------------------------------------------------
// Modaler
// ---------------------------------------------------------------------------

function RollModal({
  antal,
  initialRoller,
  onSpara,
  onStäng,
}: {
  antal: number
  initialRoller?: Roll[]
  onSpara: (roller: Roll[], typ: RollÄndringTyp) => void
  onStäng: () => void
}) {
  const [valda, setValda] = useState<Roll[]>(initialRoller ?? ['Användare'])
  const [typ, setTyp] = useState<RollÄndringTyp>('ersätt')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onStäng}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Ändra roller</h2>
            <p className="text-violet-200 text-sm mt-0.5">
              {antal === 1 ? '1 användare' : `${antal} användare markerade`}
            </p>
          </div>
          <button onClick={onStäng} className="text-violet-300 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {antal > 1 && (
            <div className="flex gap-2">
              {(['ersätt', 'lägg-till'] as RollÄndringTyp[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTyp(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    typ === t
                      ? 'bg-violet-100 text-violet-700 border-violet-200'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t === 'ersätt' ? 'Ersätt roller' : 'Lägg till roller'}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {ALLA_ROLLER_LIST.map((r) => (
              <label
                key={r}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={valda.includes(r)}
                  onChange={() =>
                    setValda((prev) =>
                      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                    )
                  }
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                />
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[r]}`}
                >
                  {r}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              if (valda.length > 0) onSpara(valda, typ)
            }}
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
  { label: '3 dagar', dagar: 3 },
  { label: '1 vecka', dagar: 7 },
  { label: '2 veckor', dagar: 14 },
  { label: '1 månad', dagar: 30 },
  { label: 'Ingen påminnelse', dagar: null },
]

function StängAvModal({
  antal,
  arbetar,
  fel,
  resultat,
  onSpara,
  onStäng,
}: {
  antal: number
  arbetar?: boolean
  fel?: string | null
  resultat?: MassResultat | null
  onSpara: (anledning: string, paminnelseOm: number | null) => void
  onStäng: () => void
}) {
  const [anledning, setAnledning] = useState('')
  const [paminnelseDagar, setPaminnelseDagar] = useState<number | null>(7)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onStäng}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Stäng av konto</h2>
            <p className="text-amber-100 text-sm mt-0.5">
              {antal === 1 ? '1 användare' : `${antal} användare markerade`}
            </p>
          </div>
          <button onClick={onStäng} className="text-amber-200 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        {resultat ? (
          <MassResultatVy resultat={resultat} onStäng={onStäng} />
        ) : (
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Anledning{' '}
                <span className="normal-case text-slate-400 font-normal">
                  (frivillig, syns för andra admins)
                </span>
              </label>
              <textarea
                rows={3}
                value={anledning}
                onChange={(e) => setAnledning(e.target.value)}
                placeholder="T.ex. 'Missbrukade feedback-kanalen för spam'"
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Påminn mig om
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PÅMINNELSE_VAL.map((v) => (
                  <button
                    key={v.label}
                    onClick={() => setPaminnelseDagar(v.dagar)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                      v.dagar === paminnelseDagar
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
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
            {fel && (
              <p role="alert" className="text-sm text-red-600">
                {fel}
              </p>
            )}
            <button
              onClick={() => onSpara(anledning, paminnelseDagar)}
              disabled={arbetar}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {arbetar ? 'Stänger av…' : 'Stäng av'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RaderaModal({
  antal,
  namn,
  namnLista,
  fel,
  raderar,
  resultat,
  onBekräfta,
  onStäng,
}: {
  antal: number
  namn?: string
  /** Massradering: namnen som berörs, så bekräftelsen visar exakt vilka konton. */
  namnLista?: string[]
  fel?: string | null
  raderar?: boolean
  resultat?: MassResultat | null
  onBekräfta: () => void
  onStäng: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onStäng}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Radera konto</h2>
            <p className="text-red-200 text-sm mt-0.5">{namn ?? `${antal} användare markerade`}</p>
          </div>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        {resultat ? (
          <MassResultatVy resultat={resultat} onStäng={onStäng} />
        ) : (
          <div className="px-6 py-5 flex flex-col gap-4">
            {namnLista && namnLista.length > 0 && (
              <p className="text-sm font-medium text-slate-800" data-testid="radera-namnlista">
                Du håller på att radera {namnLista.length}{' '}
                {namnLista.length === 1 ? 'konto' : 'konton'}: {namnSammanfattning(namnLista)}.
              </p>
            )}
            <p className="text-sm text-slate-600">
              Kontot spärras omedelbart. Namn, e-post och lösenord anonymiseras permanent i enlighet
              med GDPR artikel 17 — men inte förrän om{' '}
              <span className="font-medium">24 timmar</span>, så det går att ångra om det behövs.
              Efter det kan det inte ångras.
            </p>
            {fel && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">{fel}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onStäng}
                disabled={raderar}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={onBekräfta}
                disabled={raderar}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {raderar ? 'Raderar…' : 'Radera permanent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

interface AnvandareProps {
  onÖppnaÄrende?: (arendeId: string) => void
  defaultÖppnaEpost?: string
  defaultFlik?: DetaljFlik
  /** Anropas när djuplänken öppnat sin användare, så föräldern nollställer den (V2-16). */
  onDjuplänkKonsumerad?: () => void
}

export default function Anvandare({
  onÖppnaÄrende,
  defaultÖppnaEpost,
  defaultFlik,
  onDjuplänkKonsumerad,
}: AnvandareProps) {
  const { aktivVy, roll, email: egenEpostRå } = useAuth()
  // Support (och en Admin som förhandsvisar Support-vyn) LÄSER användarna — inga
  // åtgärder: ingen avstängning/radering/mejl/bevakningar/källor/push/
  // sparat och ingen massmarkering. Backend nekar dessa med 403 för Support (D1, V3-10),
  // så knapparna döljs i stället för att ge en felruta.
  const skrivskyddad = effektivAdminRoll(roll, aktivVy) === 'Support'
  const egenEpost = egenEpostRå?.toLowerCase() ?? null
  const queryClient = useQueryClient()
  const {
    data: adminUsers,
    isLoading: laddar,
    isError: laddningFel,
    refetch,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
  })
  const [användare, setAnvändare] = useState<Användare[]>([])
  const [rollFilter, setRollFilter] = useState<Roll | 'Alla'>('Alla')
  const [statusFilter, setStatusFilter] = useState<Status | 'Alla'>('Alla')
  const [sökning, setSökning] = useState('')
  const [vald, setVald] = useState<Användare | null>(null)
  const [detaljFlik, setDetaljFlik] = useState<DetaljFlik>('oversikt')
  const [markerade, setMarkerade] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<'roller' | 'stäng-av' | 'radera' | null>(null)
  const [enkildStängAv, setEnkildStängAv] = useState<Användare | null>(null)
  const [enkildRadera, setEnkildRadera] = useState<Användare | null>(null)
  const [raderar, setRaderar] = useState(false)
  const [raderaFel, setRaderaFel] = useState<string | null>(null)
  const [stängerAv, setStängerAv] = useState(false)
  const [stängAvFel, setStängAvFel] = useState<string | null>(null)
  const [massArbetar, setMassArbetar] = useState(false)
  const [massResultat, setMassResultat] = useState<MassResultat | null>(null)
  const [enkildRollÄndring, setEnkildRollÄndring] = useState<Användare | null>(null)
  const [skickarLösenordsåterställning, setSkickarLösenordsåterställning] = useState(false)
  const [skickarVerifieringsmail, setSkickarVerifieringsmail] = useState(false)
  const [mejlFeedback, setMejlFeedback] = useState<string | null>(null)

  const filtrerade = användare.filter((u) => {
    if (rollFilter !== 'Alla' && !u.roller.includes(rollFilter)) return false
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (
      sökning &&
      !u.namn.toLowerCase().includes(sökning.toLowerCase()) &&
      !u.epost.toLowerCase().includes(sökning.toLowerCase()) &&
      !String(u.joinNr).includes(sökning)
    )
      return false
    return true
  })

  // Egen rad kan aldrig massmarkeras (backend avvisar självspärr/självradering).
  const ärEgenRad = (u: Användare) => egenEpost !== null && u.epost.toLowerCase() === egenEpost
  // "Markera alla" väljer bara det som är rimligt att massåtgärda: inte egen rad,
  // inte Admin-konton och inte redan raderade konton. Admin-konton kan fortfarande
  // markeras ett i taget — backend avvisar då sista aktiva admin med tydligt fel per rad.
  const ärMassmarkerbar = (u: Användare) =>
    !ärEgenRad(u) && !u.roller.includes('Admin') && u.status !== 'Raderat'
  const massmarkerbara = filtrerade.filter(ärMassmarkerbar)
  const antalMarkeradeBland = massmarkerbara.filter((u) => markerade.has(u.id)).length
  const allaMarkerade = massmarkerbara.length > 0 && antalMarkeradeBland === massmarkerbara.length
  const delvisMarkerade = antalMarkeradeBland > 0 && !allaMarkerade

  function toggleMarkerad(e: React.MouseEvent, u: Användare) {
    e.stopPropagation()
    if (skrivskyddad || ärEgenRad(u)) return
    setMarkerade((prev) => {
      const ny = new Set(prev)
      if (ny.has(u.id)) ny.delete(u.id)
      else ny.add(u.id)
      return ny
    })
  }

  function toggleAllaMarkerade() {
    if (skrivskyddad) return
    setMarkerade((prev) => {
      const ny = new Set(prev)
      if (allaMarkerade) massmarkerbara.forEach((u) => ny.delete(u.id))
      else massmarkerbara.forEach((u) => ny.add(u.id))
      return ny
    })
  }

  useEffect(() => {
    if (!adminUsers) return
    // Visningsnummer baserat på registreringsordning (äldst = 1) — inte GUID:et,
    // som varken är läsbart eller meningsfullt att visa för en admin.
    const joinNrById = new Map(
      [...adminUsers]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((u, i) => [u.id, i + 1]),
    )
    setAnvändare(adminUsers.map((dto) => mapAdminUser(dto, joinNrById.get(dto.id)!)))
  }, [adminUsers])

  // Håller den öppna detaljpanelen i synk efter en statusändring (stäng av/
  // aktivera/radera/ångra radering) — annars visar panelen kvarhängande
  // gammal status tills den stängs och öppnas igen.
  useEffect(() => {
    setVald((prev) => {
      if (!prev) return prev
      const uppdaterad = användare.find((u) => u.id === prev.id)
      return uppdaterad ?? prev
    })
  }, [användare])

  // V3-8: varje flik i detaljpanelen skiljer laddar / fel (med Försök igen) / tomt — ett
  // misslyckat anrop får inte se ut som "Inga bevakningar" eller "Ingen historik".
  const ärendeFråga = useQuery({
    queryKey: ['admin-tickets-for-user', vald?.id],
    queryFn: () => fetchAdminTickets({ userId: vald!.id }),
    enabled: !!vald,
  })
  const valdsÄrenden = ärendeFråga.data ?? []

  const bevakningFråga = useQuery({
    queryKey: ['admin-polisen-bevakningar', vald?.id],
    queryFn: () => fetchAdminUserPolisenBevakningar(vald!.id),
    enabled: !!vald,
  })
  const polisenBevakningar = bevakningFråga.data ?? []
  const bevakningarLaddar = bevakningFråga.isLoading
  const [redigerarBevakning, setRedigerarBevakning] = useState<
    AdminPolisenBevakningDto | 'ny' | null
  >(null)

  function invalideraBevakningar() {
    queryClient.invalidateQueries({ queryKey: ['admin-polisen-bevakningar', vald?.id] })
    queryClient.invalidateQueries({ queryKey: ['admin-setting-log', vald?.id] })
  }

  const skapaBevakningMutation = useMutation({
    mutationFn: (req: { kategorier: string[] | null; omraden: string[] | null }) =>
      createAdminUserPolisenBevakning(vald!.id, req),
    onSuccess: invalideraBevakningar,
  })
  const uppdateraBevakningMutation = useMutation({
    mutationFn: ({
      bevakningId,
      ...req
    }: {
      bevakningId: string
      kategorier: string[] | null
      omraden: string[] | null
    }) => updateAdminUserPolisenBevakning(vald!.id, bevakningId, req),
    onSuccess: invalideraBevakningar,
  })
  const taBortBevakningMutation = useMutation({
    mutationFn: (bevakningId: string) => deleteAdminUserPolisenBevakning(vald!.id, bevakningId),
    onSuccess: invalideraBevakningar,
  })

  // Modalen stängs först när servern bekräftat; vid fel visas felet i modalen och valen finns kvar.
  function sparaBevakning(kategorier: string[] | null, omraden: string[] | null) {
    if (skapaBevakningMutation.isPending || uppdateraBevakningMutation.isPending) return
    const stäng = { onSuccess: () => setRedigerarBevakning(null) }
    if (redigerarBevakning === 'ny') {
      skapaBevakningMutation.mutate({ kategorier, omraden }, stäng)
    } else if (redigerarBevakning) {
      uppdateraBevakningMutation.mutate(
        { bevakningId: redigerarBevakning.id, kategorier, omraden },
        stäng,
      )
    }
  }
  const bevakningSparFel = skapaBevakningMutation.error ?? uppdateraBevakningMutation.error
  const bevakningSparFelText = bevakningSparFel
    ? visaFel(bevakningSparFel, 'Bevakningen kunde inte sparas. Försök igen.')
    : null

  const källFråga = useQuery({
    queryKey: ['admin-user-sources', vald?.id],
    queryFn: () => fetchAdminUserSources(vald!.id),
    enabled: !!vald,
  })
  const valdaKällor = källFråga.data ?? []
  const källorLaddar = källFråga.isLoading

  const pushFråga = useQuery({
    queryKey: ['admin-user-push-settings', vald?.id],
    queryFn: () => fetchAdminUserPushSettings(vald!.id),
    enabled: !!vald,
  })
  const pushInstallningar = pushFråga.data
  const pushLaddar = pushFråga.isLoading

  const andraPushMutation = useMutation({
    mutationFn: (req: {
      pushEnabled?: boolean
      pushNyaHandelser?: boolean
      pushNyVersion?: boolean
    }) => setAdminUserPushSettings(vald!.id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-push-settings', vald?.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-setting-log', vald?.id] })
    },
  })

  const växlaKällaMutation = useMutation({
    mutationFn: ({ sourceId, isActive }: { sourceId: number; isActive: boolean }) =>
      setAdminUserSourceActive(vald!.id, sourceId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-sources', vald?.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-setting-log', vald?.id] })
    },
  })

  // Förklara-händelse — supportverktyg (inte en editerbar inställning): visar
  // varför en given händelse syns/inte syns i DEN HÄR användarens Mitt flöde,
  // istället för att en supportagent ska behöva räkna ut det manuellt utifrån
  // Aktiva källor + Polisen-bevakningar ovan. Skopat på vald.id, nollställs
  // när en annan användare väljs (samma useEffect nedan som andra vald-scopade
  // states i den här filen).
  const [forklaraSokord, setForklaraSokord] = useState('')
  const [forklaraTraffar, setForklaraTraffar] = useState<AdminSearchEvent[]>([])
  const [forklaraSoker, setForklaraSoker] = useState(false)
  const [forklaratEvent, setForklaratEvent] = useState<AdminSearchEvent | null>(null)
  const [forklaring, setForklaring] = useState<AdminExplainEventDto | null>(null)
  const [forklaringLaddar, setForklaringLaddar] = useState(false)
  const [forklaraFel, setForklaraFel] = useState<string | null>(null)
  const [sparatFel, setSparatFel] = useState<string | null>(null)

  async function sokForklaraHandelse() {
    if (!forklaraSokord.trim()) return
    setForklaraSoker(true)
    setForklaratEvent(null)
    setForklaring(null)
    setForklaraFel(null)
    try {
      const resultat = await searchEvents({ sokord: forklaraSokord.trim(), pageSize: 5 })
      setForklaraTraffar(resultat.events)
    } catch (fel) {
      // Ett fel är inte "inga träffar".
      setForklaraTraffar([])
      setForklaraFel(visaFel(fel, 'Sökningen misslyckades. Försök igen.'))
    } finally {
      setForklaraSoker(false)
    }
  }

  async function valjForklaraHandelse(ev: AdminSearchEvent) {
    if (!vald) return
    setForklaratEvent(ev)
    setForklaring(null)
    setForklaringLaddar(true)
    setForklaraFel(null)
    try {
      setForklaring(await explainAdminUserEvent(vald.id, ev.id))
    } catch (fel) {
      setForklaraFel(visaFel(fel, 'Kunde inte hämta förklaringen. Försök igen.'))
    } finally {
      setForklaringLaddar(false)
    }
  }

  const notisFråga = useQuery({
    queryKey: ['admin-notification-log', vald?.id],
    queryFn: () => fetchAdminUserNotificationLog(vald!.id),
    enabled: !!vald,
  })
  const notishistorik = notisFråga.data ?? []
  const notishistorikLaddar = notisFråga.isLoading

  const histFråga = useQuery({
    queryKey: ['admin-setting-log', vald?.id],
    queryFn: () => fetchAdminUserSettingLog(vald!.id),
    enabled: !!vald,
  })
  const installningshistorik = histFråga.data ?? []
  const installningshistorikLaddar = histFråga.isLoading

  // Djuplänken konsumeras EN gång: så fort användaren hittats öppnas panelen
  // och föräldern nollställer defaultÖppnaEpost. Därefter gör en refetch av
  // `användare` ingenting här, så panelen hoppar inte tillbaka (V2-16, E6#3).
  useEffect(() => {
    if (!defaultÖppnaEpost) return
    const u = användare.find((x) => x.epost === defaultÖppnaEpost)
    if (u) {
      setVald(u)
      setDetaljFlik(defaultFlik ?? 'oversikt')
      onDjuplänkKonsumerad?.()
    }
  }, [defaultÖppnaEpost, defaultFlik, användare, onDjuplänkKonsumerad])

  function öppnaDetalj(u: Användare) {
    setVald(u)
    setDetaljFlik('oversikt')
    setMejlFeedback(null)
    setForklaraSokord('')
    setForklaraTraffar([])
    setForklaratEvent(null)
    setForklaring(null)
  }

  async function skickaLösenordsåterställning(u: Användare) {
    setSkickarLösenordsåterställning(true)
    setMejlFeedback(null)
    try {
      await sendAdminUserPasswordReset(u.id)
      setMejlFeedback('Återställningsmejl skickat.')
    } catch (err) {
      setMejlFeedback(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSkickarLösenordsåterställning(false)
    }
  }

  async function skickaVerifieringsmail(u: Användare) {
    setSkickarVerifieringsmail(true)
    setMejlFeedback(null)
    try {
      await resendAdminUserVerification(u.id)
      setMejlFeedback('Verifieringsmejl skickat.')
    } catch (err) {
      setMejlFeedback(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSkickarVerifieringsmail(false)
    }
  }

  const sparatFråga = useQuery({
    queryKey: ['admin-saved-events', vald?.id],
    queryFn: () => fetchAdminUserSavedEvents(vald!.id),
    enabled: !!vald,
  })
  const sparadeHändelser = sparatFråga.data ?? []
  const refetchSparat = sparatFråga.refetch

  const [dödaLänkar, setDödaLänkar] = useState<Set<string>>(new Set())

  // Öppnar länken direkt (synkront i klicket, aldrig efter en await) och kollar
  // i bakgrunden — markeras som död bara vid ett entydigt 'dead' (404/410).
  function öppnaSparad(h: { eventId: string; url: string }) {
    window.open(h.url, '_blank', 'noopener,noreferrer')
    checkEventLinkStatus(h.eventId)
      .then((status) => {
        if (status === 'dead') setDödaLänkar((prev) => new Set(prev).add(h.eventId))
      })
      .catch(() => {
        /* kollen är bara en bonus — ett fel ska aldrig störa */
      })
  }

  async function taBortSparad(eventId: string) {
    if (!vald) return
    const handelse = sparadeHändelser.find((h) => h.eventId === eventId)
    setSparatFel(null)
    try {
      await unsaveAdminUserEvent(vald.id, eventId)
    } catch (fel) {
      setSparatFel(visaFel(fel, 'Händelsen kunde inte tas bort. Försök igen.'))
      return
    }
    await refetchSparat()
    if (handelse) {
      try {
        await createActivityLogEntry({
          typ: 'Kontoåtgärd',
          rubrik: `Tog bort sparad händelse från ${vald.namn}`,
          detalj: `"${handelse.title}" (${handelse.sourceName}) borttagen från ${vald.namn}s konto.`,
          aktivVy,
          ångraData: {
            anvandareId: vald.id,
            handelse: {
              eventId: handelse.eventId,
              title: handelse.title,
              sourceName: handelse.sourceName,
              publishedAt: handelse.publishedAt,
              sparadDatum: handelse.savedAt,
            },
            undoAction: 'lägg-till',
          },
        })
      } catch {
        setSparatFel('Händelsen togs bort, men kunde inte loggas i aktivitetsloggen.')
      }
    }
  }

  function applicerapRoller(roller: Roll[], typ: RollÄndringTyp) {
    setAnvändare((prev) =>
      prev.map((u) => {
        if (!markerade.has(u.id)) return u
        const nyaRoller = typ === 'ersätt' ? roller : Array.from(new Set([...u.roller, ...roller]))
        return { ...u, roller: nyaRoller }
      }),
    )
    setMarkerade(new Set())
    setModal(null)
  }

  function applicerapRollerEnkild(u: Användare, roller: Roll[]) {
    setAnvändare((prev) => prev.map((x) => (x.id === u.id ? { ...x, roller } : x)))
    setVald((prev) => (prev?.id === u.id ? { ...prev, roller } : prev))
    setEnkildRollÄndring(null)
  }

  function beräknaPåminnelse(dagar: number | null): string | null {
    if (dagar === null) return null
    const d = new Date()
    d.setDate(d.getDate() + dagar)
    return d.toISOString()
  }

  // Kör en åtgärd mot alla markerade konton och samlar utfallet PER RAD
  // (Promise.allSettled). Listan hämtas alltid om efteråt, även vid delvis fel,
  // och bara de lyckade raderna avmarkeras. Modalen stängs bara om allt lyckades —
  // annars visas en sammanfattning med serverns orsak per misslyckad rad.
  async function körMassåtgärd(åtgärd: (id: string) => Promise<void>, rensaVald = false) {
    if (massArbetar) return
    const ids = [...markerade]
    const namnFörId = new Map(användare.map((u) => [u.id, u.namn]))
    setMassArbetar(true)
    setMassResultat(null)
    try {
      const utfall = await Promise.allSettled(ids.map((id) => åtgärd(id)))
      const lyckade = new Set<string>()
      const fel: MassResultat['fel'] = []
      utfall.forEach((r, i) => {
        if (r.status === 'fulfilled') lyckade.add(ids[i])
        else
          fel.push({ id: ids[i], namn: namnFörId.get(ids[i]) ?? ids[i], orsak: felOrsak(r.reason) })
      })
      await refetch()
      if (rensaVald && vald && lyckade.has(vald.id)) setVald(null)
      setMarkerade((prev) => {
        const ny = new Set(prev)
        lyckade.forEach((id) => ny.delete(id))
        return ny
      })
      if (fel.length === 0) setModal(null)
      else setMassResultat({ totalt: ids.length, fel })
    } finally {
      setMassArbetar(false)
    }
  }

  function stängAv(anledning: string, påminnelseOm: number | null) {
    const reminderAt = beräknaPåminnelse(påminnelseOm)
    return körMassåtgärd((id) => setAdminUserStatus(id, false, anledning || undefined, reminderAt))
  }

  function raderaMarkerade() {
    setRaderaFel(null)
    return körMassåtgärd((id) => deleteAdminUser(id), true)
  }

  function stängMassModal() {
    setModal(null)
    setMassResultat(null)
    setRaderaFel(null)
  }

  function öppnaMassModal(typ: 'stäng-av' | 'radera') {
    setMassResultat(null)
    setRaderaFel(null)
    setModal(typ)
  }

  async function raderaEnkild(u: Användare) {
    setRaderaFel(null)
    setRaderar(true)
    try {
      await deleteAdminUser(u.id)
      await refetch()
      // Panelen hålls öppen (om den var det) så admin genast ser
      // "Raderas snart"-läget och kan ångra om det behövs.
      setEnkildRadera(null)
    } catch (err) {
      setRaderaFel(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setRaderar(false)
    }
  }

  async function angraRadering(u: Användare) {
    setRaderaFel(null)
    setRaderar(true)
    try {
      await cancelUserDeletion(u.id)
      await refetch()
    } catch (err) {
      setRaderaFel(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setRaderar(false)
    }
  }

  // V3-8: modalen stängs först när servern bekräftat; vid fel visas felet och anledningen finns kvar.
  async function stängAvEnkild(u: Användare, anledning: string, påminnelseOm: number | null) {
    if (stängerAv) return
    setStängerAv(true)
    setStängAvFel(null)
    try {
      await setAdminUserStatus(u.id, false, anledning || undefined, beräknaPåminnelse(påminnelseOm))
      await refetch()
      setEnkildStängAv(null)
    } catch (fel) {
      setStängAvFel(visaFel(fel, 'Kontot kunde inte stängas av. Försök igen.'))
    } finally {
      setStängerAv(false)
    }
  }

  async function aktiveraEnkild(u: Användare) {
    setMejlFeedback(null)
    try {
      await setAdminUserStatus(u.id, true)
      await refetch()
    } catch (fel) {
      setMejlFeedback(visaFel(fel, 'Kontot kunde inte aktiveras. Försök igen.'))
    }
  }

  const antal = {
    totalt: användare.length,
    aktiva: användare.filter((u) => u.status === 'Aktiv').length,
    betatestare: användare.filter((u) => u.roller.includes('Betatestare')).length,
    avstängda: användare.filter((u) => u.status === 'Avstängd').length,
  }

  const markeradeNamn = användare.filter((u) => markerade.has(u.id)).map((u) => u.namn)

  // Rubrikcheckboxens indeterminate-läge kan bara sättas via DOM-egenskapen.
  const rubrikCheckboxRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = delvisMarkerade
  }
  const harOverifierad = (u: Användare) => u.kontaktuppgifter.some((k) => !k.verifierad)

  return (
    <div className="flex flex-col gap-6">
      {skrivskyddad && (
        <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          Skrivskyddad vy — som Support kan du titta på användarnas uppgifter men inte ändra dem.
          Ändringar görs av en administratör.
        </p>
      )}

      {/* Modaler — bulk */}
      {modal === 'roller' && (
        <RollModal
          antal={markerade.size}
          onSpara={applicerapRoller}
          onStäng={() => setModal(null)}
        />
      )}
      {modal === 'stäng-av' && (
        <StängAvModal
          antal={markerade.size}
          arbetar={massArbetar}
          resultat={massResultat}
          onSpara={stängAv}
          onStäng={stängMassModal}
        />
      )}
      {modal === 'radera' && (
        <RaderaModal
          antal={markerade.size}
          namnLista={markeradeNamn}
          fel={raderaFel}
          raderar={massArbetar}
          resultat={massResultat}
          onBekräfta={raderaMarkerade}
          onStäng={stängMassModal}
        />
      )}

      {/* Modaler — enskild */}
      {enkildRollÄndring && (
        <RollModal
          antal={1}
          initialRoller={enkildRollÄndring.roller}
          onSpara={(roller) => applicerapRollerEnkild(enkildRollÄndring, roller)}
          onStäng={() => setEnkildRollÄndring(null)}
        />
      )}
      {enkildStängAv && (
        <StängAvModal
          antal={1}
          arbetar={stängerAv}
          fel={stängAvFel}
          onSpara={(anledning, påminnelseOm) =>
            stängAvEnkild(enkildStängAv, anledning, påminnelseOm)
          }
          onStäng={() => {
            setStängAvFel(null)
            setEnkildStängAv(null)
          }}
        />
      )}
      {enkildRadera && (
        <RaderaModal
          antal={1}
          namn={enkildRadera.namn}
          fel={raderaFel}
          raderar={raderar}
          onBekräfta={() => raderaEnkild(enkildRadera)}
          onStäng={() => {
            setEnkildRadera(null)
            setRaderaFel(null)
          }}
        />
      )}

      {/* Statistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Totalt', värde: antal.totalt, färg: 'text-slate-800' },
          { label: 'Aktiva', värde: antal.aktiva, färg: 'text-green-600' },
          { label: 'Betatestare', värde: antal.betatestare, färg: 'text-amber-600' },
          { label: 'Avstängda', värde: antal.avstängda, färg: 'text-red-600' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center"
          >
            <p className={`text-3xl font-bold ${s.färg}`}>{s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabell */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap min-h-[60px]">
          {markerade.size > 0 ? (
            <>
              <span className="text-sm font-medium text-violet-700">
                {markerade.size} markerade
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  disabled
                  title="Inte kopplat mot backend än — ingen endpoint för att ändra roll"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"
                >
                  Ändra roller
                </button>
                <button
                  onClick={() => öppnaMassModal('stäng-av')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Stäng av
                </button>
                <button
                  onClick={() => öppnaMassModal('radera')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  Radera
                </button>
                <button
                  onClick={() => setMarkerade(new Set())}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕ Avmarkera
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Sök namn, e-post eller ID..."
                value={sökning}
                onChange={(e) => setSökning(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full sm:w-60"
              />
              <div className="flex flex-wrap gap-1 md:ml-auto">
                {ALLA_ROLLER_FILTER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRollFilter(r)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${rollFilter === r ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {ALLA_STATUSAR.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                {!skrivskyddad && (
                  <th className="px-6 py-3 w-10">
                    <input
                      type="checkbox"
                      ref={rubrikCheckboxRef}
                      checked={allaMarkerade}
                      onChange={toggleAllaMarkerade}
                      disabled={massmarkerbara.length === 0}
                      aria-label="Markera alla"
                      title="Markerar alla utom administratörer och ditt eget konto"
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
                    />
                  </th>
                )}
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
              {filtrerade.map((u) => (
                <tr
                  key={u.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${markerade.has(u.id) ? 'bg-violet-50' : ''}`}
                  onClick={() => öppnaDetalj(u)}
                >
                  {!skrivskyddad && (
                    <td className="px-6 py-3" onClick={(e) => toggleMarkerad(e, u)}>
                      <input
                        type="checkbox"
                        checked={markerade.has(u.id)}
                        readOnly
                        disabled={ärEgenRad(u)}
                        aria-label={`Markera ${u.namn}`}
                        title={ärEgenRad(u) ? 'Du kan inte massmarkera ditt eget konto' : undefined}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                  )}
                  <td
                    className="px-2 py-3 text-xs text-slate-400 font-mono cursor-help"
                    title={`GUID: ${u.id}`}
                  >
                    #{u.joinNr}
                  </td>
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
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLS[u.status]}`}
                        >
                          {u.status}
                        </span>
                      </div>
                      {u.paminnelseAt && (
                        <p className="text-xs text-amber-500 pl-4">
                          ⏰ påminnelse {u.paminnelseAt}
                        </p>
                      )}
                      {u.raderasVid && (
                        <p className="text-xs text-red-500 pl-4">🗑 raderas {u.raderasVid}</p>
                      )}
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
              {laddar && (
                <tr>
                  <td
                    colSpan={skrivskyddad ? 7 : 8}
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Laddar användare…
                  </td>
                </tr>
              )}
              {laddningFel && (
                <tr>
                  <td
                    colSpan={skrivskyddad ? 7 : 8}
                    className="px-6 py-10 text-center text-sm text-red-500"
                  >
                    Kunde inte hämta användarlistan. Försök ladda om sidan.
                  </td>
                </tr>
              )}
              {!laddar && !laddningFel && filtrerade.length === 0 && (
                <tr>
                  <td
                    colSpan={skrivskyddad ? 7 : 8}
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Inga användare matchar filtret.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detaljpanel — backdrop */}
      {vald && <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setVald(null)} />}

      {/* Detaljpanel — slide-in från höger */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 w-full md:w-[700px] bg-white shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 ease-out ${vald ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ pointerEvents: vald ? 'auto' : 'none' }}
      >
        {vald && (
          <div className="flex flex-col flex-1">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
                  {initialer(vald.namn)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{vald.namn}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLS[vald.status]}`}
                    >
                      {vald.status}
                    </span>
                    {harOverifierad(vald) && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        Overifierad kontaktuppgift
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {vald.epost} ·{' '}
                    <span
                      title={`GUID: ${vald.id}`}
                      className="cursor-help underline decoration-dotted"
                    >
                      Nr {vald.joinNr}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVald(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Flikar */}
            <div className="flex border-b border-slate-100 px-6 overflow-x-auto">
              {(
                [
                  { id: 'oversikt', label: 'Översikt' },
                  { id: 'notifinstallningar', label: 'Notifieringsinställningar' },
                  { id: 'notishistorik', label: 'Notishistorik' },
                  { id: 'installningshistorik', label: 'Inställningshistorik' },
                  { id: 'aktivitet', label: 'Aktivitet' },
                  { id: 'ärenden', label: 'Supportärenden' },
                ] as { id: DetaljFlik; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDetaljFlik(f.id)}
                  className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors shrink-0 whitespace-nowrap ${
                    detaljFlik === f.id
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* ── Översikt ── */}
            {detaljFlik === 'oversikt' && (
              <div
                className={`px-6 py-5 grid gap-8 ${skrivskyddad ? 'grid-cols-1' : 'grid-cols-2'}`}
              >
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Roller
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {vald.roller.map((r) => (
                        <span
                          key={r}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLL_CLS[r]}`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">
                        Registrerad
                      </p>
                      <p className="text-sm text-slate-700">{vald.registrerad}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">
                        Senast aktiv
                      </p>
                      <p className="text-sm text-slate-700">{vald.senastAktiv}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">
                      Inloggningsmetod
                    </p>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INLOGGNING_CLS[vald.inloggningsmetod]}`}
                    >
                      {vald.inloggningsmetod}
                    </span>
                  </div>

                  {/* Kontaktuppgifter */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Kontaktuppgifter
                    </p>
                    <div className="flex flex-col gap-2">
                      {vald.kontaktuppgifter.map((k) => (
                        <div key={k.id} className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[k.typ]}`}
                          >
                            {k.typ}
                          </span>
                          <span className="text-sm text-slate-700">{k.värde}</span>
                          {k.primär && (
                            <span className="text-xs text-slate-400 font-medium">Primär</span>
                          )}
                          <span
                            className={`ml-auto w-2 h-2 rounded-full shrink-0 ${k.verifierad ? 'bg-green-500' : 'bg-amber-400'}`}
                            title={k.verifierad ? 'Verifierad' : 'Ej verifierad'}
                          />
                          {!k.verifierad && (
                            <span className="text-xs text-amber-600">Ej verifierad</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Polisen-bevakningar — riktig data via
                    GET /api/admin/users/{id}/polisen-bevakningar (admin-variant av
                    UserPolisenBevakningController), read-only här. Flera oberoende
                    bevakningar per användare (ELLER-kombinerade), ersätter det
                    gamla enskilda "Polisen-filter" (en AND-kombination) */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Polisen-bevakningar
                    </p>
                    {bevakningarLaddar ? (
                      <p className="text-sm text-slate-400">Laddar...</p>
                    ) : bevakningFråga.isError && bevakningFråga.data === undefined ? (
                      <HamtningsFel
                        fel={bevakningFråga.error}
                        reserv="Kunde inte hämta bevakningarna. Det är inte samma sak som att det inte finns några."
                        onForsokIgen={() => {
                          void bevakningFråga.refetch()
                        }}
                        arIgang={bevakningFråga.isFetching}
                        className="items-start text-left"
                      />
                    ) : (
                      <>
                        {polisenBevakningar.length === 0 ? (
                          <p className="text-sm text-slate-500 mb-2">
                            Inga bevakningar — får allt från Polisen.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3 mb-2">
                            {polisenBevakningar.map((b) => (
                              <div
                                key={b.id}
                                className="flex flex-col gap-2 border border-slate-100 rounded-lg p-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-400 mb-1">Typer</p>
                                    <div className="flex flex-wrap gap-1">
                                      {(b.kategorier ?? []).length > 0 ? (
                                        b.kategorier!.map((k) => (
                                          <span
                                            key={k}
                                            className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                                          >
                                            {k}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs text-slate-400">Alla</span>
                                      )}
                                    </div>
                                  </div>
                                  {!skrivskyddad && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => setRedigerarBevakning(b)}
                                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                                      >
                                        Ändra
                                      </button>
                                      <button
                                        onClick={() => taBortBevakningMutation.mutate(b.id)}
                                        disabled={taBortBevakningMutation.isPending}
                                        className="text-xs text-slate-400 hover:text-red-500 font-medium disabled:opacity-50"
                                      >
                                        Ta bort
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">Områden</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(b.omraden ?? []).length > 0 ? (
                                      b.omraden!.map((o) => (
                                        <span
                                          key={o}
                                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                                        >
                                          {o}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-400">Alla</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!skrivskyddad && (
                          <button
                            onClick={() => setRedigerarBevakning('ny')}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                          >
                            + Ny bevakning
                          </button>
                        )}
                      </>
                    )}
                    <MutationFel
                      fel={taBortBevakningMutation.error}
                      reserv="Bevakningen kunde inte tas bort. Försök igen."
                      className="mb-2"
                    />
                    {!skrivskyddad && redigerarBevakning && (
                      <KategoriFilterModal
                        sparar={
                          skapaBevakningMutation.isPending || uppdateraBevakningMutation.isPending
                        }
                        fel={bevakningSparFelText}
                        kallNamn="Polisen"
                        initialKategorier={
                          redigerarBevakning === 'ny' ? null : redigerarBevakning.kategorier
                        }
                        initialOmraden={
                          redigerarBevakning === 'ny' ? null : redigerarBevakning.omraden
                        }
                        onSpara={sparaBevakning}
                        onClose={() => setRedigerarBevakning(null)}
                      />
                    )}
                  </div>

                  {/* Aktiva källor — admin/support-skrivrätt via
                    GET/PUT /api/admin/users/{id}/sources (admin-variant av
                    UserSourcesController). Rör bara isActive, aldrig
                    sortOrder (rent kosmetiskt, användarens eget
                    drag-och-släpp i Mina källor). */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Aktiva källor
                    </p>
                    <MutationFel
                      fel={växlaKällaMutation.error}
                      reserv="Källan kunde inte ändras. Försök igen."
                      className="mb-2"
                    />
                    {källorLaddar ? (
                      <p className="text-sm text-slate-400">Laddar...</p>
                    ) : källFråga.isError && källFråga.data === undefined ? (
                      <HamtningsFel
                        fel={källFråga.error}
                        reserv="Kunde inte hämta källorna. Det är inte samma sak som att inga finns."
                        onForsokIgen={() => {
                          void källFråga.refetch()
                        }}
                        arIgang={källFråga.isFetching}
                        className="items-start text-left"
                      />
                    ) : valdaKällor.length === 0 ? (
                      <p className="text-sm text-slate-500">Inga källor tillagda.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {valdaKällor.map((k) => (
                          <div key={k.sourceId} className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-700">{k.name}</span>
                            {skrivskyddad ? (
                              <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                  k.isActive
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {k.isActive ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  växlaKällaMutation.mutate({
                                    sourceId: k.sourceId,
                                    isActive: !k.isActive,
                                  })
                                }
                                disabled={växlaKällaMutation.isPending}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                                  k.isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {k.isActive ? 'Aktiv' : 'Inaktiv'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Förklara händelse — läsläge, ändrar inget. Söker mot samma
                    /api/admin/events/search som Händelsesök, kör sen
                    GET .../explain-event/{eventId} som svarar utifrån Aktiva
                    källor + Polisen-bevakningar ovan (samma prioritetsordning
                    som NewsFeed.tsx). Byggd som ett supportverktyg — svarar på
                    "varför ser/ser inte den här användaren händelse X" utan
                    att en agent ska behöva räkna ut det för hand. */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Förklara en händelse
                    </p>
                    <div className="flex gap-1.5 mb-2">
                      <input
                        type="text"
                        value={forklaraSokord}
                        onChange={(e) => setForklaraSokord(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sokForklaraHandelse()
                        }}
                        placeholder="Sök på titel, t.ex. Misshandel Gotland"
                        className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      <button
                        onClick={sokForklaraHandelse}
                        disabled={forklaraSoker || !forklaraSokord.trim()}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors shrink-0"
                      >
                        {forklaraSoker ? 'Söker…' : 'Sök'}
                      </button>
                    </div>

                    {forklaraFel && (
                      <p role="alert" className="text-xs text-red-600 mb-2">
                        {forklaraFel}
                      </p>
                    )}
                    {forklaraTraffar.length > 0 && !forklaratEvent && (
                      <div className="flex flex-col gap-1 mb-2">
                        {forklaraTraffar.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => valjForklaraHandelse(ev)}
                            className="text-left text-xs text-slate-600 hover:bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 truncate"
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {forklaratEvent && (
                      <div className="border border-slate-100 rounded-lg p-2.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs text-slate-700 font-medium">
                            {forklaratEvent.title}
                          </p>
                          <button
                            onClick={() => {
                              setForklaratEvent(null)
                              setForklaring(null)
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                          >
                            Ny sökning
                          </button>
                        </div>
                        {forklaringLaddar ? (
                          <p className="text-xs text-slate-400">Kontrollerar…</p>
                        ) : (
                          forklaring && (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${forklaring.visasIMittFlode ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                              >
                                {forklaring.visasIMittFlode ? 'Visas' : 'Visas inte'}
                              </span>
                              <p className="text-xs text-slate-600">{forklaring.anledning}</p>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Push-inställningar — skrivrätt tillagd 2026-09-13. Policy,
                    inte teknik: bara ändra åt en användare när DE SJÄLVA bett
                    om det (t.ex. via ett supportärende) — se
                    Rutiner/Konto/Push-installningar.md. Endpoint/P256dh/Auth
                    exponeras fortfarande aldrig, se controllern. */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Push-notiser{' '}
                      <span className="normal-case text-slate-300 font-normal">
                        — ändra bara om användaren själv bett om det
                      </span>
                    </p>
                    <MutationFel
                      fel={andraPushMutation.error}
                      reserv="Push-inställningen kunde inte ändras. Försök igen."
                      className="mb-2"
                    />
                    {pushLaddar ? (
                      <p className="text-sm text-slate-400">Laddar...</p>
                    ) : !pushInstallningar ? (
                      <HamtningsFel
                        fel={pushFråga.error}
                        reserv="Kunde inte hämta push-inställningarna."
                        onForsokIgen={() => {
                          void pushFråga.refetch()
                        }}
                        arIgang={pushFråga.isFetching}
                        className="items-start text-left"
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            {
                              etikett: 'Push',
                              på: pushInstallningar.pushEnabled,
                              ändra: { pushEnabled: !pushInstallningar.pushEnabled },
                            },
                            {
                              etikett: 'Ny händelse',
                              på: pushInstallningar.pushNyaHandelser,
                              ändra: { pushNyaHandelser: !pushInstallningar.pushNyaHandelser },
                            },
                            {
                              etikett: 'Ny version',
                              på: pushInstallningar.pushNyVersion,
                              ändra: { pushNyVersion: !pushInstallningar.pushNyVersion },
                            },
                          ].map((t) => {
                            const text = `${t.etikett} ${t.på ? 'på' : 'av'}`
                            return skrivskyddad ? (
                              <span
                                key={t.etikett}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${t.på ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                              >
                                {text}
                              </span>
                            ) : (
                              <button
                                key={t.etikett}
                                onClick={() => andraPushMutation.mutate(t.ändra)}
                                disabled={andraPushMutation.isPending}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${t.på ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                              >
                                {text}
                              </button>
                            )
                          })}
                        </div>
                        {pushInstallningar.enheter.length === 0 ? (
                          <p className="text-xs text-slate-400">Inga registrerade enheter.</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {pushInstallningar.enheter.map((e) => (
                              <p key={e.id} className="text-xs text-slate-500">
                                {e.deviceName || e.platform || 'Okänd enhet'} · senast sedd{' '}
                                {new Date(e.lastSeenAt).toLocaleDateString('sv-SE')}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sparat (#298, punkt 9) — riktig backend-persistens via
                    GET/POST/DELETE /api/admin/users/{id}/saved-events
                    (UserSavedEvent-tabellen). Skrivs från Händelsesök */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                      Sparat
                    </p>
                    {sparatFel && (
                      <p role="alert" className="text-xs text-red-600 mb-2">
                        {sparatFel}
                      </p>
                    )}
                    {sparatFråga.isError && sparatFråga.data === undefined ? (
                      <HamtningsFel
                        fel={sparatFråga.error}
                        reserv="Kunde inte hämta sparade händelser. Det är inte samma sak som att inga finns."
                        onForsokIgen={() => {
                          void sparatFråga.refetch()
                        }}
                        arIgang={sparatFråga.isFetching}
                        className="items-start text-left"
                      />
                    ) : sparadeHändelser.length === 0 ? (
                      <p className="text-sm text-slate-400">Inga sparade händelser.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {sparadeHändelser.map((h) => (
                          <div
                            key={h.eventId}
                            className="flex items-start justify-between gap-2 text-sm"
                          >
                            <div className="min-w-0">
                              {dödaLänkar.has(h.eventId) ? (
                                <>
                                  <p className="text-slate-500 truncate">{h.title}</p>
                                  <p className="text-xs text-amber-600">
                                    ⚠️ Sidan finns inte längre hos källan —{' '}
                                    <a
                                      href={h.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:text-amber-700"
                                    >
                                      öppna ändå
                                    </a>
                                  </p>
                                </>
                              ) : (
                                <button
                                  onClick={() => öppnaSparad(h)}
                                  className="text-slate-700 hover:text-violet-600 hover:underline truncate block text-left"
                                >
                                  {h.title}
                                </button>
                              )}
                              <p className="text-xs text-slate-400">
                                {h.sourceName} · sparad{' '}
                                {new Date(h.savedAt).toLocaleDateString('sv-SE')}
                              </p>
                            </div>
                            {!skrivskyddad && (
                              <button
                                onClick={() => taBortSparad(h.eventId)}
                                className="shrink-0 text-xs text-slate-400 hover:text-red-500 transition-colors"
                              >
                                Ta bort
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {vald.paminnelseAt && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-amber-700">
                        ⏰ Påminnelse satt till {vald.paminnelseAt}
                      </p>
                      {vald.paminnelseNotering && (
                        <p className="text-xs text-amber-600 mt-0.5">{vald.paminnelseNotering}</p>
                      )}
                      <p className="text-xs text-amber-600 mt-0.5">
                        Kontot återaktiveras inte automatiskt — det här är bara en påminnelse att
                        titta på fallet igen.
                      </p>
                    </div>
                  )}

                  {vald.status === 'Raderas snart' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex flex-col gap-2">
                      <p className="text-xs font-medium text-red-700">
                        🗑 Raderas (anonymiseras) automatiskt {vald.raderasVid}
                      </p>
                      <p className="text-xs text-red-600">
                        Går att ångra fram till dess — därefter permanent.
                      </p>
                      {raderaFel && (
                        <p className="text-xs text-red-700 bg-red-100 rounded-lg px-2.5 py-1.5">
                          {raderaFel}
                        </p>
                      )}
                      {!skrivskyddad && (
                        <button
                          onClick={() => angraRadering(vald)}
                          disabled={raderar}
                          className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {raderar ? 'Ångrar…' : 'Ångra radering'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Åtgärder */}
                {!skrivskyddad && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                      Åtgärder
                    </p>
                    <button
                      disabled
                      title="Inte kopplat mot backend än — ingen endpoint för att ändra roll"
                      className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-300 cursor-not-allowed"
                    >
                      Ändra roller
                    </button>
                    <button
                      onClick={() => skickaLösenordsåterställning(vald)}
                      disabled={skickarLösenordsåterställning}
                      className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                    >
                      {skickarLösenordsåterställning ? 'Skickar…' : 'Skicka lösenordsåterställning'}
                    </button>
                    {vald.kontaktuppgifter.some((k) => !k.verifierad) && (
                      <button
                        onClick={() => skickaVerifieringsmail(vald)}
                        disabled={skickarVerifieringsmail}
                        className="text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                      >
                        {skickarVerifieringsmail ? 'Skickar…' : 'Skicka verifieringsmail'}
                      </button>
                    )}
                    {mejlFeedback && <p className="text-xs text-slate-500">{mejlFeedback}</p>}
                    {vald.status === 'Avstängd' && (
                      <button
                        onClick={() => aktiveraEnkild(vald)}
                        className="text-left px-4 py-2.5 rounded-xl border border-green-200 text-sm text-green-700 hover:bg-green-50 transition-colors"
                      >
                        Aktivera konto
                      </button>
                    )}
                    {vald.status === 'Aktiv' && (
                      <button
                        onClick={() => setEnkildStängAv(vald)}
                        className="text-left px-4 py-2.5 rounded-xl border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        Stäng av konto
                      </button>
                    )}
                    <button
                      onClick={() => setEnkildRadera(vald)}
                      disabled={vald.status === 'Raderat' || vald.status === 'Raderas snart'}
                      title={
                        vald.status === 'Raderat'
                          ? 'Kontot är redan raderat'
                          : vald.status === 'Raderas snart'
                            ? 'Radering är redan schemalagd — se panelen ovan'
                            : undefined
                      }
                      className="text-left px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                    >
                      Radera konto (GDPR)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Notifieringsinställningar ── inget API bakom fliken; riktig data ligger under Översikt */}
            {detaljFlik === 'notifinstallningar' && (
              <div className="pb-8">
                <IngetKopplatAn rubrik="Inga notifieringsinställningar visas här">
                  Den här fliken är inte kopplad till backend. Användarens riktiga aktiva källor,
                  Polisen-bevakningar och push-inställningar finns under Översikt.
                </IngetKopplatAn>
                <div className="flex justify-center">
                  <button
                    onClick={() => setDetaljFlik('oversikt')}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    Visa under Översikt
                  </button>
                </div>
              </div>
            )}

            {/* ── Notishistorik ── */}
            {detaljFlik === 'notishistorik' && (
              <div>
                {notishistorikLaddar ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">Laddar...</p>
                ) : notisFråga.isError && notisFråga.data === undefined ? (
                  <HamtningsFel
                    fel={notisFråga.error}
                    reserv="Kunde inte hämta notishistoriken. Det är inte samma sak som att inga notiser skickats."
                    onForsokIgen={() => {
                      void notisFråga.refetch()
                    }}
                    arIgang={notisFråga.isFetching}
                    className="px-6 py-10"
                  />
                ) : notishistorik.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">
                    Inga notiser skickade till den här användaren.
                  </p>
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
                      {notishistorik.map((n, i) => (
                        <Fragment key={i}>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                              {new Date(n.sentAt).toLocaleString('sv-SE')}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${NOTIF_LOG_CHANNEL_CLS[n.channel] ?? NOTIF_LOG_CHANNEL_FALLBACK_CLS}`}
                              >
                                {NOTIF_LOG_CHANNEL_LABEL[n.channel] ?? n.channel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                              {förkortaMottagare(n.recipient)}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {n.sourceName ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{n.subject}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${NOTIF_LOG_STATUS_CLS[n.status] ?? NOTIF_LOG_STATUS_FALLBACK_CLS}`}
                              >
                                {NOTIF_LOG_STATUS_LABEL[n.status] ?? n.status}
                              </span>
                            </td>
                          </tr>
                          {n.errorMessage && (
                            <tr className="bg-red-50">
                              <td colSpan={6} className="px-6 py-2 text-xs text-red-600">
                                <span className="font-medium">Felorsak:</span> {n.errorMessage}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Inställningshistorik ── */}
            {/* Per-användare diagnostik ("varför funkade inte e-postbytet/
              bevakningen"), inte menad att synas i den delade Senaste
              händelser-vyn — UserSettingAuditLog har loggat det här sedan
              session 18, bara aldrig haft en vy förrän nu. */}
            {detaljFlik === 'installningshistorik' && (
              <div>
                {installningshistorikLaddar ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">Laddar...</p>
                ) : histFråga.isError && histFråga.data === undefined ? (
                  <HamtningsFel
                    fel={histFråga.error}
                    reserv="Kunde inte hämta inställningshistoriken. Det är inte samma sak som ingen historik."
                    onForsokIgen={() => {
                      void histFråga.refetch()
                    }}
                    arIgang={histFråga.isFetching}
                    className="px-6 py-10"
                  />
                ) : installningshistorik.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">
                    Ingen inställningshistorik för den här användaren.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                        <th className="text-left px-6 py-3 font-medium">Tid</th>
                        <th className="text-left px-4 py-3 font-medium">Inställning</th>
                        <th className="text-left px-4 py-3 font-medium">Från → Till</th>
                        <th className="text-left px-4 py-3 font-medium">Av</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {installningshistorik.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                            {new Date(s.changedAt).toLocaleString('sv-SE')}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {SETTING_LABEL[s.setting] ?? s.setting}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {s.oldValue == null && s.newValue == null
                              ? '—'
                              : `${s.oldValue ?? '(inget)'} → ${s.newValue ?? '(borttaget)'}`}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {s.changedBy === 'user' ? 'Användaren själv' : s.changedBy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Supportärenden ── */}
            {detaljFlik === 'ärenden' && (
              <div>
                {ärendeFråga.isLoading ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">Laddar...</p>
                ) : ärendeFråga.isError && ärendeFråga.data === undefined ? (
                  <HamtningsFel
                    fel={ärendeFråga.error}
                    reserv="Kunde inte hämta ärendena. Det är inte samma sak som att inga finns."
                    onForsokIgen={() => {
                      void ärendeFråga.refetch()
                    }}
                    arIgang={ärendeFråga.isFetching}
                    className="px-6 py-10"
                  />
                ) : valdsÄrenden.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-slate-400">
                    Inga supportärenden kopplade till den här användaren.
                  </p>
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
                      {valdsÄrenden.map((a) => (
                        <tr
                          key={a.id}
                          onClick={() => onÖppnaÄrende?.(a.id)}
                          className={`hover:bg-slate-50 transition-colors ${onÖppnaÄrende ? 'cursor-pointer' : ''}`}
                        >
                          <td className="px-6 py-3 font-mono text-xs text-slate-400">
                            {ticketNr(a)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                              {a.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{a.subject}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ARENDE_STATUS_CLS[a.status as ArendeStatusMini]}`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(a.createdAt).toLocaleDateString('sv-SE')}
                          </td>
                          {onÖppnaÄrende && (
                            <td className="pr-4 py-3 text-right text-xs text-violet-600">
                              Öppna →
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Aktivitet ── ingen inloggningsspårning finns än */}
            {detaljFlik === 'aktivitet' && (
              <IngetKopplatAn rubrik="Ingen aktivitet registreras än">
                Inloggningar och användaraktivitet spåras inte, så den här fliken kan inte visa
                något. Det betyder inte att användaren är inaktiv.
              </IngetKopplatAn>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
