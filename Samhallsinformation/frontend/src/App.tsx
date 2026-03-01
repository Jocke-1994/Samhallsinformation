import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from './components/Sidebar/Sidebar'
import NewsFeed from './components/NewsFeed/NewsFeed'
import { fetchSources } from './api/sources'

import type { Source } from './types'

function useUnreadSourceIds(sources: Source[], readTrigger: number): Set<number> {
  // Returnerar set av sourceId:n som har minst en oläst nyhet
  // readTrigger används för att tvinga omräkning när något markeras läst
  void readTrigger
  const stored = localStorage.getItem('si_read_events')
  const readIds: Set<string> = stored ? new Set(JSON.parse(stored)) : new Set()
  return new Set(
    sources
      .filter(s => s.isActive)
      .filter(s => {
        const cached = sessionStorage.getItem(`si_events_${s.id}`)
        if (!cached) return false
        const events: { id: string }[] = JSON.parse(cached)
        return events.some(e => !readIds.has(e.id))
      })
      .map(s => s.id)
  )
}

function HomePage() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null)
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
    <div className="flex h-screen bg-neutral-950">
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

function ProfilePage() {
  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar
        selectedSourceId={null}
        onSelectSource={() => {}}
        unreadSourceIds={new Set()}
      />
      <main className="flex-1 flex items-center justify-center text-white">
        <h1 className="text-2xl font-bold">Profil (kommer snart)</h1>
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
