import { useState, useCallback, useEffect, useMemo } from 'react'
import { Routes, Route, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSwipeable } from 'react-swipeable'
import Sidebar from './components/Sidebar/Sidebar'
import NewsFeed from './components/NewsFeed/NewsFeed'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import CookieConsent from './components/CookieConsent/CookieConsent'
import OmPage from './pages/OmPage'
import VillkorPage from './pages/VillkorPage'
import UppdateringarPage from './pages/UppdateringarPage'
import { fetchSources } from './api/sources'
import { fetchUserSources } from './api/userSources'
import { useUnreadSourceIds } from './hooks/useUnreadSourceIds'
import { useAuth } from './context/AuthContext'
import { useFlags } from './context/FeatureFlagsContext'
import { resendVerification } from './api/auth'
import { fetchMaintenanceBanners } from './api/maintenanceBanners'
import type { Source } from './types'

function HomePage() {
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [selectedShortName, setSelectedShortName] = useState<string | null>(
    (location.state as { shortName?: string } | null)?.shortName ?? null
  )
  const [viewMode, setViewMode] = useState<'Allt' | 'Mitt'>(
    (location.state as { viewMode?: 'Allt' | 'Mitt' } | null)?.viewMode ?? 'Allt'
  )
  const [readTrigger, setReadTrigger] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Allt/Mitt är bara meningsfullt i det kombinerade flödet för inloggade —
  // annars filtrerar ett kvarhängande "Mitt"-läge tyst en enskild källas vy.
  useEffect(() => { if (!isLoggedIn) setViewMode('Allt') }, [isLoggedIn])
  useEffect(() => { if (selectedShortName !== null) setViewMode('Allt') }, [selectedShortName])

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const { data: userSources = [] } = useQuery({
    queryKey: ['user-sources'],
    queryFn: fetchUserSources,
    enabled: isLoggedIn,
  })

  const activeSourceIds = useMemo(
    () => new Set(userSources.filter(p => p.isActive).map(p => p.sourceId)),
    [userSources]
  )

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
    <div className="flex h-full bg-slate-50 dark:bg-slate-900">
      <Sidebar
        selectedShortName={selectedShortName}
        onSelectSource={setSelectedShortName}
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        unreadSourceIds={unreadSourceIds}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-hidden select-none md:select-auto">
        <NewsFeed
          shortName={selectedShortName}
          sources={sources}
          activeSourceIds={activeSourceIds}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
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
    <div className="bg-amber-500 px-6 py-2.5 flex items-center justify-between shadow-md">
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

const VERIFY_BANNER_SNOOZE_KEY = 'si_verify_banner_snoozed_until'
const VERIFY_BANNER_SNOOZE_MS  = 24 * 60 * 60 * 1000

function EmailVerificationBanner() {
  const { isLoggedIn, emailVerified, email } = useAuth()
  const flaggor = useFlags()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [snoozedUntil, setSnoozedUntil] = useState<number>(
    () => Number(localStorage.getItem(VERIFY_BANNER_SNOOZE_KEY) ?? 0)
  )

  if (!isLoggedIn || emailVerified || !flaggor.konto_epost_paminnelse || Date.now() < snoozedUntil) return null

  async function handleResend() {
    setStatus('sending')
    try {
      await resendVerification()
      setStatus('sent')
    } catch {
      setStatus('idle')
    }
  }

  function handleSnooze() {
    const until = Date.now() + VERIFY_BANNER_SNOOZE_MS
    localStorage.setItem(VERIFY_BANNER_SNOOZE_KEY, String(until))
    setSnoozedUntil(until)
  }

  return (
    <div className="bg-violet-600 px-6 py-2.5 flex items-center justify-between gap-3 shadow-md flex-wrap">
      <span className="text-sm text-white">
        Bekräfta din e-postadress{email ? ` — vi har skickat en länk till ${email}` : ''}.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleSnooze}
          className="text-xs font-medium text-white/80 hover:text-white underline underline-offset-2 transition-colors"
        >
          Påminn senare
        </button>
        <button
          onClick={handleResend}
          disabled={status !== 'idle'}
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 disabled:opacity-70 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {status === 'sent' ? 'Skickat!' : status === 'sending' ? 'Skickar…' : 'Skicka igen'}
        </button>
      </div>
    </div>
  )
}

const MAINTENANCE_DISMISS_PREFIX = 'si_maintenance_dismissed_'

// Global driftmeddelande-banderoll för planerade drifttillfällen (t.ex.
// Railways underhållsfönster). Flera meddelanden kan vara aktiva samtidigt
// (olika målgrupper, olika tidsfönster) — varje rad från backend renderas
// som en egen banderoll, staplade i wrappern i App(). Visas/döljs
// automatiskt utifrån Start/End + målgrupp, ingen manuell avstängning krävs
// efteråt. Varje banderoll har sin egen stängs-nyckel (bundet till dess id),
// så att stänga en inte påverkar någon annan.
function MaintenanceBanners() {
  const { isLoggedIn } = useAuth()
  const { data: banners = [] } = useQuery({
    queryKey: ['maintenance-banners'],
    queryFn: fetchMaintenanceBanners,
    staleTime: 5 * 60_000,
  })

  const nu = Date.now()
  const aktiva = banners.filter(b => {
    if (nu < new Date(b.startUtc).getTime() || nu > new Date(b.endUtc).getTime()) return false
    if (b.audience === 'Besökare' && isLoggedIn)  return false
    if (b.audience === 'Användare' && !isLoggedIn) return false
    return true
  })

  return (
    <>
      {aktiva.map(b => <EnMaintenanceBanner key={b.id} banner={b} />)}
    </>
  )
}

// Stängs-nyckeln innehåller innehållet, inte bara id:t — annars skulle en
// admin-redigering av ett redan stängt meddelandes text/tider aldrig synas
// igen för den som redan stängt bort den ursprungliga texten.
function bannerAvtryck(b: { message: string; startUtc: string; endUtc: string }): string {
  return `${b.message}|${b.startUtc}|${b.endUtc}`
}

function EnMaintenanceBanner({ banner }: { banner: { id: string; message: string; startUtc: string; endUtc: string } }) {
  const dismissKey = MAINTENANCE_DISMISS_PREFIX + banner.id
  const avtryck = bannerAvtryck(banner)
  const [dismissatAvtryck, setDismissatAvtryck] = useState(() => localStorage.getItem(dismissKey))

  if (dismissatAvtryck === avtryck) return null

  return (
    <div className="bg-orange-600 px-6 py-2.5 flex items-center justify-between gap-3 shadow-md flex-wrap">
      <span className="text-[18px] text-white flex-1 text-center">
        {banner.message}
      </span>
      <button
        onClick={() => { localStorage.setItem(dismissKey, avtryck); setDismissatAvtryck(avtryck) }}
        className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        Stäng
      </button>
    </div>
  )
}

// Banderollstacken ligger i normalt dokumentflöde (inte fixed) ovanför en
// h-full-yta, så den knuffar undan sidinnehållet istället för att lägga sig
// ovanpå det — annars täcker den t.ex. "Samhällsinfo"-texten högst upp i
// sidomenyn. De enskilda sidorna (HomePage m.fl.) är h-full, inte h-screen,
// så de fyller exakt det som blir kvar under banderollerna.
export default function App() {
  return (
    <div className="h-dvh flex flex-col">
      <div className="flex flex-col shrink-0">
        <ImpersonationBanner />
        <MaintenanceBanners />
        <EmailVerificationBanner />
      </div>
      <div className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<OnboardingPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/om" element={<OmPage />} />
          <Route path="/villkor" element={<VillkorPage />} />
          <Route path="/uppdateringar" element={<UppdateringarPage />} />
        </Routes>
      </div>
      <CookieConsent />
    </div>
  )
}
