import { useState } from 'react'
import ObligatoriskaKallor from './ObligatoriskaKallor'
import Mottagare from './Mottagare'
import StorEj from './StorEj'
import Leveranslage from './Leveranslage'
import NotisHistorik from './NotisHistorik'
import { useFlags } from '../../../context/FeatureFlagsContext'

export type SektionKey = 'epost' | 'sms' | 'push'

export interface MottagareKontakt {
  id: number
  kontakt: string
  smeknamn: string
  aktiv: boolean
}

export type AllData = Record<SektionKey, MottagareKontakt[]>

const INITIAL_DATA: AllData = {
  epost: [],
  sms: [],
  push: [{ id: 5, kontakt: 'iPhone', smeknamn: '', aktiv: true }],
}

let nextMottagareId = 10

export default function Notifieringar() {
  const [mottagare, setMottagare] = useState<AllData>(INITIAL_DATA)
  const flaggor = useFlags()

  function getNextId() {
    return nextMottagareId++
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Övre rad: två kort sida vid sida */}
      {(flaggor.notif_obligatoriska || flaggor.notif_mottagare) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {flaggor.notif_obligatoriska && <ObligatoriskaKallor data={mottagare} />}
          {flaggor.notif_mottagare && (
            <Mottagare data={mottagare} onChange={setMottagare} getNextId={getNextId} />
          )}
        </div>
      )}

      {/* Andra rad: två kort */}
      {(flaggor.notif_stor_ej || flaggor.notif_leveranslage) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {flaggor.notif_stor_ej && <StorEj />}
          {flaggor.notif_leveranslage && <Leveranslage data={mottagare} />}
        </div>
      )}

      {flaggor.notif_historik && <NotisHistorik />}
    </div>
  )
}
