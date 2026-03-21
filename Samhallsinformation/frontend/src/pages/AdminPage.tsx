import { useState } from 'react'
import AdminSidebar, { type AdminSection } from '../components/Admin/AdminSidebar'
import Oversikt from '../components/Admin/Oversikt'
import Kallhantering from '../components/Admin/Kallhantering'

const SECTION_LABELS: Record<AdminSection, string> = {
  'oversikt':       'Översikt',
  'kallor':         'Källhantering',
  'anvandare':      'Användarhantering',
  'support-inbox':  'Support-inbox',
  'aktivitetslogg': 'Aktivitetslogg',
  'rapporter':      'Rapporter',
  'felsökning':     'Felsökning',
  'impersonation':  'Impersonation',
}

export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>('oversikt')

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      <AdminSidebar active={section} onSelect={setSection} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-slate-900">{SECTION_LABELS[section]}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-red-100 text-red-700 px-3 py-1 rounded-full">Admin-läge</span>
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700">A</div>
          </div>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '2rem 3rem' }}>
          <div style={{ maxWidth: '1100px' }}>

            {section === 'oversikt'  && <Oversikt onNavigate={setSection} />}
            {section === 'kallor'   && <Kallhantering />}

            {section !== 'oversikt' && section !== 'kallor' && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-4xl mb-4">🚧</p>
                <p className="text-lg font-semibold text-slate-700">{SECTION_LABELS[section]}</p>
                <p className="text-sm text-slate-400 mt-1">Kommer byggas ut i nästa steg.</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
