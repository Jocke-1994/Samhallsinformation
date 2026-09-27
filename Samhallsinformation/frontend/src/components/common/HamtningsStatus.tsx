import type { ReactNode } from 'react'
import { visaFel } from '../../lib/felmeddelande'

// V3-8 (E6#8): admin får aldrig tolka ett misslyckat anrop som "tomt", "0" eller
// "100 % frisk". En hämtning har tre olika utfall som ska se olika ut:
//   laddar → "Laddar ..."
//   fel    → begripligt meddelande (role="alert") + "Försök igen"
//   tomt   → ett bekräftat tomt svar
// HamtningsStatus renderar de tre lägena runt en lista/ett kort; HamtningsFel är
// den lilla felrutan för ytor som inte omsluts (t.ex. ett enskilt stat-kort).

/** Den delmängd av UseQueryResult som komponenterna behöver. */
export interface HamtningsFraga {
  isLoading: boolean
  isError: boolean
  error: unknown
  isFetching?: boolean
  refetch: () => unknown
  data?: unknown
}

interface FelProps {
  fel: unknown
  /** Reservtext när felet är tekniskt (statuskod, nätverk) — serverns svenska text visas i stället. */
  reserv: string
  onForsokIgen?: () => void
  arIgang?: boolean
  className?: string
}

export function HamtningsFel({ fel, reserv, onForsokIgen, arIgang, className = '' }: FelProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-2 text-center text-sm text-red-600 ${className}`}>
      <p>{visaFel(fel, reserv)}</p>
      {onForsokIgen && (
        <button
          type="button"
          onClick={onForsokIgen}
          disabled={arIgang}
          className="text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {arIgang ? 'Försöker...' : 'Försök igen'}
        </button>
      )}
    </div>
  )
}

/** Felruta för en misslyckad mutation (spara, skicka, tilldela ...). Renderar inget om felet saknas. */
export function MutationFel({ fel, reserv, className = '' }: { fel: unknown; reserv: string; className?: string }) {
  if (fel == null) return null
  return (
    <p role="alert" className={`text-sm text-red-600 ${className}`}>{visaFel(fel, reserv)}</p>
  )
}

interface Props {
  fraga: HamtningsFraga
  /** Text i felrutan när felet är tekniskt, t.ex. "Kunde inte hämta ärendena." */
  felText: string
  /** True när svaret lyckades men saknar innehåll. */
  tomt?: boolean
  tomtText?: ReactNode
  laddarText?: string
  className?: string
  children: ReactNode
}

export default function HamtningsStatus({
  fraga, felText, tomt = false, tomtText = 'Inget att visa.', laddarText = 'Laddar...', className = 'px-6 py-8', children,
}: Props) {
  const harData = fraga.data !== undefined

  if (fraga.isLoading) {
    return <div className={`${className} text-center text-sm text-slate-400`}>{laddarText}</div>
  }

  if (fraga.isError && !harData) {
    return (
      <HamtningsFel
        fel={fraga.error}
        reserv={felText}
        onForsokIgen={() => { void fraga.refetch() }}
        arIgang={fraga.isFetching}
        className={className}
      />
    )
  }

  return (
    <>
      {/* Senaste omhämtningen misslyckades men en tidigare lista finns: visa den, men säg det. */}
      {fraga.isError && (
        <HamtningsFel
          fel={fraga.error}
          reserv={`${felText} Det som visas kan vara inaktuellt.`}
          onForsokIgen={() => { void fraga.refetch() }}
          arIgang={fraga.isFetching}
          className="px-6 py-3"
        />
      )}
      {tomt
        ? <div className={`${className} text-center text-sm text-slate-400`}>{tomtText}</div>
        : children}
    </>
  )
}
