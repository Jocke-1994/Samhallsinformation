// Versionsnumret som en liten bricka ("v1.1") bredvid datumet — på Senaste-
// kortet, i historiken och i Vad är nytt-rutan (beslut 2026-11-02). Visas inte
// alls för poster utan version, t.ex. de före numreringen.
export default function VersionsBricka({ version, påFärg = false }: {
  version: string | null | undefined
  /** På det lila kortets huvud i stället för på vit/grå bakgrund. */
  påFärg?: boolean
}) {
  const v = version?.trim()
  if (!v) return null
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
      påFärg
        ? 'bg-white/20 text-white'
        : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'}`}>
      v{v}
    </span>
  )
}
