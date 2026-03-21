import { useState } from 'react'
import ObligatoriskaKallor from './ObligatoriskaKallor'
import Mottagare from './Mottagare'
import KallorLista from './KallorLista'
import StorEj from './StorEj'
import Leveranslage from './Leveranslage'
import NotisHistorik from './NotisHistorik'

export type SektionKey = 'epost' | 'sms' | 'push'

export interface MottagareKontakt {
  id:       number
  kontakt:  string
  smeknamn: string
  aktiv:    boolean
}

export type AllData = Record<SektionKey, MottagareKontakt[]>

const INITIAL_DATA: AllData = {
  epost: [
    { id: 1, kontakt: 'din@epost.se',  smeknamn: 'Mig',   aktiv: true },
    { id: 2, kontakt: 'mamma@mail.se', smeknamn: 'Mamma', aktiv: true },
  ],
  sms:  [
    { id: 3, kontakt: '073-XXX XX XX', smeknamn: 'Mig',   aktiv: true },
    { id: 4, kontakt: '070-XXX XX XX', smeknamn: 'Mamma', aktiv: false },
  ],
  push: [
    { id: 5, kontakt: 'iPhone', smeknamn: '', aktiv: true },
  ],
}

let nextMottagareId = 10

export default function Notifieringar() {
  const [mottagare, setMottagare] = useState<AllData>(INITIAL_DATA)

  function getNextId() { return nextMottagareId++ }

  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* Övre rad: två kort sida vid sida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ObligatoriskaKallor />
        <Mottagare data={mottagare} onChange={setMottagare} getNextId={getNextId} />
      </div>

      {/* Andra rad: tre kort */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <KallorLista />
        <StorEj />
        <Leveranslage data={mottagare} />
      </div>

      {/* Notifieringshistorik */}
      <NotisHistorik />

    </div>
  )
}
