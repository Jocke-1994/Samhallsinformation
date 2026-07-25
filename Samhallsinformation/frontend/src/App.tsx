import { useState, useCallback } from 'react'
import { Routes, Route, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSwipeable } from 'react-swipeable'
import Sidebar from './components/Sidebar/Sidebar'
import NewsFeed from './components/NewsFeed/NewsFeed'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import CookieConsent from './components/CookieConsent/CookieConsent'
import OmPage from './pages/OmPage'
import UppdateringarPage from './pages/UppdateringarPage'
import WelcomeModal from './components/WelcomeModal/WelcomeModal'
import { fetchSources } from './api/sources'
import { useUnreadSourceIds } from './hooks/useUnreadSourceIds'
import type { Source } from './types'

function HomePage() {
  const location = useLocation()
  const [selectedShortName, setSelectedShortName] = useState<string | null>(
    (location.state as { shortName?: string } | null)?.shortName ?? null
  )
  const [readTrigger, setReadTrigger] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const unreadSourceIds = useUnreadSourceIds(sources, readTrigger)

  const handleReadStatusChange = useCallback(() => {
    setReadTrigger(n => n + 1)
  }, [])

  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => { if (e.initial[0] < 30) setSidebarOpen(true) },
    onSwipedLeft:  ()  => setSidebarOpen(false),
    preventScrollOnSwipe: true,
    touchEventOptions: { passive: false },
  })

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        selectedShortName={selectedShortName}
        onSelectSource={setSelectedShortName}
        unreadSourceIds={unreadSourceIds}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <WelcomeModal />
      <main {...swipeHandlers} className="flex-1 overflow-hidden select-none md:select-auto">
        <NewsFeed
          shortName={selectedShortName}
          sources={sources}
          onReadStatusChange={handleReadStatusChange}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </main>
    </div>
  )
}

function ImpersonationBanner() {
  const [params] = useSearchParams()
  const namn = params.get('namn')
  if (!params.has('impersonating') || !namn) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 px-6 py-2.5 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2.5">
        <span className="text-base">🎭</span>
        <span className="text-sm font-medium text-white">
          Du är inloggad som <strong>{namn}</strong> — adminläge
        </span>
      </div>
      <button
        onClick={() => window.close()}
        className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        Avsluta session
      </button>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ImpersonationBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/om" element={<OmPage />} />
        <Route path="/uppdateringar" element={<UppdateringarPage />} />
      </Routes>
      <CookieConsent />
    </>
  )
}
