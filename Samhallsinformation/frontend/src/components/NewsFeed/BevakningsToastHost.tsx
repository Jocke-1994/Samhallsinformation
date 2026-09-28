import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePolisenBevakningar } from '../../context/PolisenBevakningarContext'
import { stängBevakningsToast, useBevakningsToast, visaBevakningsToast } from './bevakningsToastStore'

// Renderar bekräftelse-/fel-/Ångra-toasten för bevakningsklockan. Måste
// monteras på en nivå som överlever att enskilda flödeskort avmonteras (App).
export default function BevakningsToastHost() {
  const toast = useBevakningsToast()
  const { skapa } = usePolisenBevakningar()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(stängBevakningsToast, 5000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null
  const ångra = toast.ångra

  async function hanteraÅngra() {
    stängBevakningsToast()
    if (!ångra) return
    try {
      const lyckades = await skapa(ångra.kategorier ? [...ångra.kategorier] : null, ångra.omraden ? [...ångra.omraden] : null)
      if (!lyckades) {
        visaBevakningsToast({ typ: 'fel', text: 'Kunde inte ångra — du har redan max antal bevakningar. Hantera dem i Mina källor.' })
      }
    } catch {
      visaBevakningsToast({ typ: 'fel', text: 'Kunde inte återskapa bevakningen. Försök igen.' })
    }
  }

  return createPortal(
    <div
      role={toast.typ === 'fel' ? 'alert' : 'status'}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 ${toast.typ === 'fel' ? 'bg-red-700' : 'bg-slate-900'}`}
    >
      <span>{toast.text}</span>
      {ångra && (
        <button onClick={hanteraÅngra} className="font-semibold text-violet-300 hover:text-violet-200 transition-colors shrink-0">
          Ångra
        </button>
      )}
    </div>,
    document.body,
  )
}
