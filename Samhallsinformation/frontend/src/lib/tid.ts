// Delad mellan den publika driftbanderollen (App.tsx) och admin-listan
// (MaintenanceBannerAdmin.tsx) — en enda källa så en framtida formatfix
// inte missar den ena kopian.
export function formatSvensktDatumTid(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
