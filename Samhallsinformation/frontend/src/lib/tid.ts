// Delad mellan den publika driftbanderollen (App.tsx) och admin-listan
// (MaintenanceBannerAdmin.tsx) — en enda källa så en framtida formatfix
// inte missar den ena kopian.
export function formatSvensktDatumTid(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// datetime-local ger/tar lokal (webbläsarens) väggklocketid, inte UTC — admin
// jobbar alltid från Sverige så vi konverterar rakt av via Date, ingen egen
// tidszonslogik behövs. Delad mellan MaintenanceBannerAdmin.tsx och
// AdminUppdateringar.tsx (var tidigare kopierad rakt av mellan de två,
// se code review-fynd PR #590).
export function isoTillDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
