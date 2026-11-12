// Delad märkning för mock-ytor i adminpanelen (beslut D3, V3-20). Allt som visar
// exempeldata eller saknar backend ska bära någon av de här, så att ingen
// (framför allt inte en supportagent) läser fabricerad data som sanning.

/** Liten "MOCK"-pill för en rubrikrad. */
export function MockBadge({ titel }: { titel?: string }) {
  return (
    <span
      title={titel ?? 'MOCK — exempeldata, inte riktig funktion'}
      className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300"
    >
      MOCK
    </span>
  )
}

/** Bred banderoll överst på en mock-yta. `children` kan förklara vad som saknas. */
export function MockBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="note"
      className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2.5"
    >
      <MockBadge />
      <div className="text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">MOCK — exempeldata, inte riktig funktion</p>
        {children && <p className="mt-0.5 text-amber-800">{children}</p>}
      </div>
    </div>
  )
}

/**
 * Omsluter en mock-yta: visar banderollen och inaktiverar varje knapp och
 * formulärfält inuti (ett `<fieldset disabled>` gör det åt alla barn), så att
 * inga åtgärdsknappar låtsas att något hände.
 */
export function MockYta({
  förklaring,
  children,
}: {
  förklaring?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4">
        <MockBanner>{förklaring}</MockBanner>
      </div>
      <fieldset disabled className="min-w-0 border-0 p-0 m-0 opacity-60">
        {children}
      </fieldset>
    </div>
  )
}

/** Ersätter en yta som tidigare visade mock som om den vore sanning. */
export function IngetKopplatAn({
  rubrik,
  children,
}: {
  rubrik: string
  children?: React.ReactNode
}) {
  return (
    <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        Inte kopplat än
      </span>
      <p className="text-sm font-medium text-slate-700">{rubrik}</p>
      {children && <p className="text-xs text-slate-500 max-w-md leading-relaxed">{children}</p>}
    </div>
  )
}
