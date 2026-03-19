import { useState, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from './components/Sidebar/Sidebar'
import NewsFeed from './components/NewsFeed/NewsFeed'
import ProfilePage from './pages/ProfilePage'
import { fetchSources } from './api/sources'
import { useUnreadSourceIds } from './hooks/useUnreadSourceIds'

import type { Source } from './types'

function HomePage() {
  const location = useLocation()
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(
    (location.state as { sourceId?: number } | null)?.sourceId ?? null
  )
  const [readTrigger, setReadTrigger] = useState(0)

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const unreadSourceIds = useUnreadSourceIds(sources, readTrigger)

  const selectedSource = sources.find(s => s.id === selectedSourceId) ?? null

  const handleReadStatusChange = useCallback(() => {
    setReadTrigger(n => n + 1)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        selectedSourceId={selectedSourceId}
        onSelectSource={setSelectedSourceId}
        unreadSourceIds={unreadSourceIds}
      />
      <main className="flex-1 overflow-hidden">
        <NewsFeed
          source={selectedSource}
          onReadStatusChange={handleReadStatusChange}
        />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/profil" element={<ProfilePage />} />
    </Routes>
  )
}
