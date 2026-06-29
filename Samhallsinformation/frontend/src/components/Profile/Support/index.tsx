import ArendehanteringKort from './ArendehanteringKort'
import SystemstatusKort from './SystemstatusKort'
import FaqKort from './FaqKort'
import { useFlags } from '../../../context/FeatureFlagsContext'

export default function Support() {
  const flaggor = useFlags()

  return (
    <div className="flex flex-col gap-8 mt-6">

      {flaggor.support_arenden && <ArendehanteringKort />}

      {flaggor.support_systemstatus && flaggor.support_faq && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SystemstatusKort />
          <FaqKort />
        </div>
      )}

      {flaggor.support_systemstatus && !flaggor.support_faq && <SystemstatusKort />}

      {flaggor.support_faq && !flaggor.support_systemstatus && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <FaqKort />
          </div>
        </div>
      )}

    </div>
  )
}
