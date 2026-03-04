import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchSources } from '../../api/sources'
import SourceButton from './SourceButton'
import type { Source } from '../../types'

interface Props {
  selectedSourceId: number | null
  onSelectSource: (id: number | null) => void
  unreadSourceIds: Set<number>
}

export default function Sidebar({ selectedSourceId, onSelectSource, unreadSourceIds }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const isProfileActive = location.pathname === '/profil'

  return (
    <nav className="flex flex-col h-full w-52 bg-neutral-900 border-r border-neutral-800 p-2 gap-1">
      <SourceButton
        label="Profil"
        active={isProfileActive}
        hasUnread={false}
        onClick={() => navigate('/profil')}
      />

      <div className="border-t border-neutral-700 my-1" />

      {sources.filter(s => s.isActive).map(source => (
        <SourceButton
          key={source.id}
          label={source.shortName}
          active={selectedSourceId === source.id && !isProfileActive}
          hasUnread={unreadSourceIds.has(source.id)}
          onClick={() => {
            navigate('/')
            onSelectSource(source.id)
          }}
        />
      ))}
    </nav>
  )
}
