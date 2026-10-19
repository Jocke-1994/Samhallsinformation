import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export type IdeaStage = 'brainstorm' | 'triage' | 'byggs' | 'testas' | 'lanseringsklar' | 'lanserad' | 'avfärdad'

export interface FeatureIdeaListItemDto {
  id: string
  ideaNumber: number
  title: string
  stage: IdeaStage
  priority: number
  källaTyp: 'admin' | 'feedback'
  flagKey?: string | null
  createdAt: string
  updatedAt: string
}

export interface FeatureIdeaTesterDto {
  userId: string
  name: string
  email: string
  addedAt: string
}

export interface FeatureIdeaChecklistItemDto {
  id: string
  label: string
  done: boolean
  doneAt?: string | null
  doneByName?: string | null
}

export interface FeatureIdeaDetailDto {
  idea: FeatureIdeaListItemDto & {
    description: string
    triageKanGoras?: boolean | null
    triageBorGoras?: boolean | null
    triageMotivering?: string | null
    sourceTicketId?: string | null
    createdByName: string
  }
  testers: FeatureIdeaTesterDto[]
  checklist: FeatureIdeaChecklistItemDto[]
}

export interface CreateFeatureIdeaRequest {
  title: string
  description?: string
  källaTyp?: 'admin' | 'feedback'
  sourceTicketId?: string
}

export async function fetchFeatureIdeas(stage?: string): Promise<FeatureIdeaListItemDto[]> {
  const qs = stage ? `?stage=${encodeURIComponent(stage)}` : ''
  const res = await adminFetch(`/api/admin/feature-ideas${qs}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchFeatureIdeas')
  return res.json()
}

export async function createFeatureIdea(req: CreateFeatureIdeaRequest): Promise<{ id: string; ideaNumber: number }> {
  const res = await adminFetch('/api/admin/feature-ideas', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'createFeatureIdea')
  return res.json()
}

export async function fetchFeatureIdea(id: string): Promise<FeatureIdeaDetailDto> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchFeatureIdea')
  return res.json()
}

export async function updateFeatureIdea(id: string, req: { title?: string; description?: string; flagKey?: string | null }): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'updateFeatureIdea')
}

export async function reorderFeatureIdeas(orderedIds: string[]): Promise<void> {
  const res = await adminFetch('/api/admin/feature-ideas/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  })
  if (!res.ok) throw await felFranSvar(res, 'reorderFeatureIdeas')
}

export async function setIdeaStage(id: string, stage: IdeaStage): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/stage`, {
    method: 'PUT',
    body: JSON.stringify({ stage }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setIdeaStage')
}

export async function setIdeaTriage(id: string, kanGoras: boolean | null, borGoras: boolean | null, motivering: string | null): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/triage`, {
    method: 'PUT',
    body: JSON.stringify({ kanGoras, borGoras, motivering }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setIdeaTriage')
}

export async function addIdeaTester(id: string, email: string): Promise<FeatureIdeaTesterDto> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/testers`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw await felFranSvar(res, 'addIdeaTester')
  return res.json()
}

export async function removeIdeaTester(id: string, userId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/testers/${userId}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'removeIdeaTester')
}

export async function addChecklistItem(id: string, label: string): Promise<{ id: string }> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
  if (!res.ok) throw await felFranSvar(res, 'addChecklistItem')
  return res.json()
}

export async function toggleChecklistItem(id: string, itemId: string, done: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/checklist/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ done }),
  })
  if (!res.ok) throw await felFranSvar(res, 'toggleChecklistItem')
}

export async function removeChecklistItem(id: string, itemId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}/checklist/${itemId}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'removeChecklistItem')
}

export async function deleteFeatureIdea(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-ideas/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'deleteFeatureIdea')
}
