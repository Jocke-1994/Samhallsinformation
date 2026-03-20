import ObligatoriskaKallor from './ObligatoriskaKallor'
import GlobalaInstallningar from './GlobalaInstallningar'
import KallorLista from './KallorLista'

export default function Notifieringar() {
  const smsNummer = '070-XXX XX XX'

  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* Övre rad: två kort sida vid sida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ObligatoriskaKallor />
        <GlobalaInstallningar smsNummer={smsNummer} />
      </div>

      {/* Källista */}
      <KallorLista />

    </div>
  )
}
