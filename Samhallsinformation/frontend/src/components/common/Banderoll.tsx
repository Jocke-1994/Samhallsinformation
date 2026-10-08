import { useState } from 'react'
import { Link } from 'react-router'
import type { MaintenanceBanner, BannerStil } from '../../api/maintenanceBanners'
import { bannerAvtryck } from '../../lib/banderoll'

const MAINTENANCE_DISMISS_PREFIX = 'si_maintenance_dismissed_'

const BAKGRUND: Record<BannerStil, string> = {
  Drift:    'bg-orange-600',
  Nyhet:    'bg-violet-700',
  Kommande: 'bg-emerald-700',
}

function läsStängd(nyckel: string): string | null {
  try { return localStorage.getItem(nyckel) } catch { return null }
}

// En banderoll högst upp på sajten. Utan rubrik och länk ser den ut exakt som
// driftbanderollen alltid gjort (en centrerad rad). Med rubrik: på dator
// "Rubrik: Meddelande · Läs mer" på en rad, på mobil på varsin rad.
export default function Banderoll({ banner }: { banner: MaintenanceBanner }) {
  const dismissKey = MAINTENANCE_DISMISS_PREFIX + banner.id
  const avtryck = bannerAvtryck(banner)
  const [dismissatAvtryck, setDismissatAvtryck] = useState(() => läsStängd(dismissKey))

  if (dismissatAvtryck === avtryck) return null

  function stäng() {
    try { localStorage.setItem(dismissKey, avtryck) } catch { /* privat läge — stängs bara för sidvisningen */ }
    setDismissatAvtryck(avtryck)
  }

  const harRubrik = !!banner.rubrik
  const bakgrund = BAKGRUND[banner.stil] ?? BAKGRUND.Drift

  return (
    <div className={`${bakgrund} px-6 py-2.5 flex items-center justify-between gap-3 shadow-md ${harRubrik ? 'max-sm:items-start' : 'flex-wrap'}`}>
      {harRubrik ? (
        <p className="flex-1 min-w-0 text-white flex flex-col sm:flex-row sm:flex-wrap sm:justify-center sm:items-baseline sm:gap-x-1.5 text-sm sm:text-[18px]">
          <span className="max-sm:text-xs max-sm:opacity-90">{banner.rubrik}<span className="max-sm:hidden">:</span></span>
          <span className="font-semibold max-sm:text-[15px]">{banner.message}</span>
          {banner.lankUrl && (
            <>
              <span aria-hidden className="max-sm:hidden">·</span>
              <Link to={banner.lankUrl} className="font-bold underline underline-offset-4 hover:opacity-80 self-start sm:self-auto">
                Läs mer
              </Link>
            </>
          )}
        </p>
      ) : (
        <span className="text-[18px] text-white flex-1 text-center">
          {banner.message}
          {banner.lankUrl && (
            <> · <Link to={banner.lankUrl} className="font-bold underline underline-offset-4 hover:opacity-80">Läs mer</Link></>
          )}
        </span>
      )}
      <button
        onClick={stäng}
        className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        Stäng
      </button>
    </div>
  )
}
