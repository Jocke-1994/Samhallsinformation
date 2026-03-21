import ObligatoriskaKallor from './ObligatoriskaKallor'
import Mottagare from './Mottagare'
import KallorLista from './KallorLista'
import StorEj from './StorEj'
import NotisHistorik from './NotisHistorik'

export default function Notifieringar() {
  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* Övre rad: två kort sida vid sida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ObligatoriskaKallor />
        <Mottagare />
      </div>

      {/* Andra rad: två kort sida vid sida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KallorLista />
        <StorEj />
      </div>

      {/* Notifieringshistorik */}
      <NotisHistorik />

    </div>
  )
}
