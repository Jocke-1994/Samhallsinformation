import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import { makeField, type FormField } from './kontoTypes'
import KontoInfo from './KontoInfo'
import SparSamtycke from './SparSamtycke'
import ThemeKort from './ThemeKort'
import AppNotiserKort from './AppNotiserKort'
import AktivitetsloggKort from './AktivitetsloggKort'
import SessionerKort from './SessionerKort'
import TvafaktorKort from './TvafaktorKort'
import LösenordByte from './LösenordByte'
import Datahantering from './Datahantering'
import { useFlags } from '../../../context/FeatureFlagsContext'

export default function Konto() {
  const [namn, setNamn] = useState<FormField>(makeField(''))
  const [epost, setEpost] = useState<FormField>(makeField(''))
  const [telefon, setTelefon] = useState<FormField>(makeField(''))
  const location = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)
  const flaggor = useFlags()

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
    <div className="flex flex-col gap-6 mt-6">

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

      {/* Tvåkolumns grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Vänster kolumn */}
        <div className="flex flex-col gap-6">
          {flaggor.konto_info && <KontoInfo
            namn={namn}
            epost={epost}
            telefon={telefon}
            onUpdateNamn={value => update(setNamn, value)}
            onUpdateEpost={value => update(setEpost, value)}
            onUpdateTelefon={value => update(setTelefon, value)}
            onSaveNamn={() => save(setNamn, () => namn.value.trim() ? '' : 'Ange ett namn.')}
            onSaveEpost={() => save(setEpost, () => epost.value.includes('@') ? '' : 'Ange en giltig e-postadress.')}
            onSaveTelefon={() => save(setTelefon, () => telefon.value.trim() ? '' : 'Ange ett telefonnummer.')}
            onRemoveTelefon={() => setTelefon(makeField(''))}
          />}
          {flaggor.konto_losenord && <LösenordByte />}
          {flaggor.konto_tvafaktor && <TvafaktorKort harTelefon={telefon.saved && !!telefon.value} />}
          {flaggor.konto_samtycke && <SparSamtycke />}
        </div>

        {/* Höger kolumn */}
        <div className="flex flex-col gap-6">
          {flaggor.konto_tema && <ThemeKort />}
          {flaggor.konto_app_notiser && <AppNotiserKort />}
          {flaggor.konto_sessioner && <SessionerKort />}
          {flaggor.konto_aktivitetslogg && <AktivitetsloggKort />}
          {flaggor.konto_datahantering && <Datahantering
            highlightId={highlightId}
            namnValue={namn.value}
            epostValue={epost.value}
          />}
        </div>

      </div>

    </div>
  )
}
