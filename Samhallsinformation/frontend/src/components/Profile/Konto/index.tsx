import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { makeField, type FormField } from './kontoTypes'
import KontoInfo from './KontoInfo'
import SparSamtycke from './SparSamtycke'
import LösenordByte from './LösenordByte'
import Datahantering from './Datahantering'

export default function Konto() {
  const [namn, setNamn] = useState<FormField>(makeField(''))
  const [epost, setEpost] = useState<FormField>(makeField(''))
  const location = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), 4200)
    return () => clearTimeout(timer)
  }, [highlightId])

  function update(setter: React.Dispatch<React.SetStateAction<FormField>>, value: string) {
    setter(prev => ({ ...prev, value, saved: false, error: '' }))
  }

  function save(setter: React.Dispatch<React.SetStateAction<FormField>>, validate?: () => string) {
    const err = validate?.() ?? ''
    if (err) { setter(prev => ({ ...prev, error: err, saved: false })); return }
    setter(prev => ({ ...prev, saved: true, error: '' }))
  }

  return (
    <div className="flex flex-col gap-6 mt-6 max-w-xl mx-auto w-full">

      {/* Avatar + namn-banner */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl px-8 py-8 flex items-center gap-6 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold shrink-0 backdrop-blur-sm">
          {namn.value ? namn.value[0].toUpperCase() : 'JO'}
        </div>
        <div>
          <p className="text-white text-xl font-bold tracking-tight">
            {namn.value || 'Ditt namn'}
          </p>
          <p className="text-violet-200 text-sm mt-0.5">
            {epost.value || 'din@epost.se'}
          </p>
        </div>
      </div>

      <KontoInfo
        namn={namn}
        epost={epost}
        onUpdateNamn={value => update(setNamn, value)}
        onUpdateEpost={value => update(setEpost, value)}
        onSaveNamn={() => save(setNamn, () => namn.value.trim() ? '' : 'Ange ett namn.')}
        onSaveEpost={() => save(setEpost, () => epost.value.includes('@') ? '' : 'Ange en giltig e-postadress.')}
      />

      <SparSamtycke />

      <LösenordByte />

      <Datahantering
        highlightId={highlightId}
        namnValue={namn.value}
        epostValue={epost.value}
      />

    </div>
  )
}
