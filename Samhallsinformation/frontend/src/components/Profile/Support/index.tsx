import ArendehanteringKort from './ArendehanteringKort'
import SystemstatusKort from './SystemstatusKort'
import FaqKort from './FaqKort'

export default function Support() {
  return (
    <div className="flex flex-col gap-8 mt-6">

      <ArendehanteringKort />

      {/* Systemstatus + FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemstatusKort />
        <FaqKort />
      </div>

    </div>
  )
}
