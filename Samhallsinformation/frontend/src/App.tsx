import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSwipeable } from 'react-swipeable'
import Sidebar from './components/Sidebar/Sidebar'
import NewsFeed from './components/NewsFeed/NewsFeed'
import ProfilePage from './pages/ProfilePage'
import { useNu } from './hooks/useNu'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ConfirmEmailChangePage from './pages/ConfirmEmailChangePage'
import CancelDeletionPage from './pages/CancelDeletionPage'
import CookieConsent from './components/CookieConsent/CookieConsent'
import BevakningsToastHost from './components/NewsFeed/BevakningsToastHost'
import OmPage from './pages/OmPage'
import VillkorPage from './pages/VillkorPage'
import UppdateringarPage from './pages/UppdateringarPage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/common/ErrorBoundary'
import EmailVerificationBanner from './components/common/EmailVerificationBanner'
import Banderoll from './components/common/Banderoll'
import VadArNytt from './components/common/VadArNytt'
import { fetchSources } from './api/sources'
import { useAuth } from './context/AuthContext'
import { fetchMaintenanceBanners } from './api/maintenanceBanners'
import type { Source } from './types'

function HomePage() {
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // Push-djuplänk (PushDispatcher.KällUrl): /?shortName=Polisen&handelse=<id>
  // öppnar källans flöde och scrollar fram och fäller ut händelsen. Utan
  // handelse (en push om flera händelser) öppnas bara källans flöde.
  const [selectedShortName, setSelectedShortName] = useState<string | null>(
    (location.state as { shortName?: string } | null)?.shortName ?? searchParams.get('shortName')
  )
  const länkadKälla = searchParams.get('shortName')
  const markeradHandelse = searchParams.get('handelse')
  // Ett nytt notisklick medan appen redan är öppen navigerar hit igen.
  useEffect(() => {
    if (länkadKälla) setSelectedShortName(länkadKälla)
  }, [länkadKälla, location.key])
  // Byter man själv källa i sidomenyn gäller länken inte längre.
  function väljKälla(shortName: string | null) {
    if (länkadKälla || markeradHandelse) setSearchParams({}, { replace: true })
    setSelectedShortName(shortName)
  }
  // /?vy=sparat (Prova själv → Mitt flöde → Sparat) startar i Mitt flöde.
  const [viewMode, setViewMode] = useState<'Allt' | 'Mitt'>(
    (location.state as { viewMode?: 'Allt' | 'Mitt' } | null)?.viewMode
      ?? (searchParams.get('vy') === 'sparat' ? 'Mitt' : 'Allt')
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Allt/Mitt är bara meningsfullt i det kombinerade flödet för inloggade —
  // annars filtrerar ett kvarhängande "Mitt"-läge tyst en enskild källas vy.
  useEffect(() => { if (!isLoggedIn) setViewMode('Allt') }, [isLoggedIn])
  useEffect(() => { if (selectedShortName !== null) setViewMode('Allt') }, [selectedShortName])

  // Prova själv-länk hit (/?vy=…) medan flödet redan visas, t.ex. från Vad är
  // nytt-rutan: platsfiltret och Sparat finns bara i det kombinerade flödet.
  const vy = searchParams.get('vy')
  useEffect(() => {
    if (vy !== 'plats' && vy !== 'sparat') return
    setSelectedShortName(null)
    if (vy === 'sparat' && isLoggedIn) setViewMode('Mitt')
    if (vy === 'plats') setViewMode('Allt')
  }, [vy, location.key, isLoggedIn])

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

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
        onSelectSource={väljKälla}
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main {...swipeHandlers} className="flex-1 overflow-hidden select-none md:select-auto">
        <NewsFeed
          shortName={selectedShortName}
          sources={sources}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenSidebar={() => setSidebarOpen(true)}
          markeradHandelseId={markeradHandelse}
        />
      </main>
    </div>
  )
}

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
    queryKey: ['maintenance-banners', isLoggedIn],
    queryFn: fetchMaintenanceBanners,
    staleTime: 5 * 60_000,
  })

  const nu = useNu()
  const aktiva = banners.filter(b => {
    if (nu < new Date(b.startUtc).getTime() || nu > new Date(b.endUtc).getTime()) return false
    if (b.audience === 'Besökare' && isLoggedIn)  return false
    if (b.audience === 'Användare' && !isLoggedIn) return false
    return true
  })

  return (
    <>
      {aktiva.map(b => <Banderoll key={b.id} banner={b} />)}
    </>
  )
}

// Banderollstacken ligger i normalt dokumentflöde (inte fixed) ovanför en
// h-full-yta, så den knuffar undan sidinnehållet istället för att lägga sig
// ovanpå det — annars täcker den t.ex. "Samhällsinfo"-texten högst upp i
// sidomenyn. De enskilda sidorna (HomePage m.fl.) är h-full, inte h-screen,
// så de fyller exakt det som blir kvar under banderollerna.
export default function App() {
  const location = useLocation()

  return (
    <div className="h-dvh flex flex-col">
      <div className="flex flex-col shrink-0">
        <MaintenanceBanners />
        <EmailVerificationBanner />
      </div>
      <div className="flex-1 min-h-0">
        {/* Ett kastande sidfel ska bara ersätta route-ytan — banderoller och
            cookie-banner ligger utanför. location.key nollställer felet vid
            varje navigering så att användaren inte fastnar i felvyn. */}
        <ErrorBoundary resetKeys={[location.key]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<OnboardingPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
            <Route path="/cancel-deletion" element={<CancelDeletionPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/om" element={<OmPage />} />
            <Route path="/villkor" element={<VillkorPage />} />
            <Route path="/uppdateringar" element={<UppdateringarPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <CookieConsent />
      <VadArNytt />
      <BevakningsToastHost />
    </div>
  )
}
