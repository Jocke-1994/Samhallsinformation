import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchFeatureIdea, updateFeatureIdea, setIdeaStage, setIdeaTriage,
  addIdeaTester, removeIdeaTester, addChecklistItem, toggleChecklistItem, removeChecklistItem,
  deleteFeatureIdea, type IdeaStage,
} from '../../api/featureIdeas'
import { STAGE_LABELS, STAGE_ORDER } from './FunktionsIdePipeline'
import { FLAG_DEFINITIONER } from '../../lib/featureFlags'
import { HamtningsFel, MutationFel } from '../common/HamtningsStatus'
import { visaFel } from '../../lib/felmeddelande'

const GITHUB_REPO = 'https://github.com/Jocke-1994/Samhallsinformation'
const VÄNTAT_VARNING_DAGAR = 21

function dagarSedan(iso: string): number {
  const då = new Date(iso + 'T00:00:00Z').getTime()
  const nu = Date.now()
  return Math.floor((nu - då) / (1000 * 60 * 60 * 24))
}

interface Props {
  ideaId: string
  onClose: () => void
  onÖppnaÄrende?: (ticketId: string) => void
}

export default function IdeDetaljModal({ ideaId, onClose, onÖppnaÄrende }: Props) {
  const queryClient = useQueryClient()
  const ideFråga = useQuery({ queryKey: ['feature-idea', ideaId], queryFn: () => fetchFeatureIdea(ideaId) })
  const { data } = ideFråga

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['feature-idea', ideaId] })
    queryClient.invalidateQueries({ queryKey: ['feature-ideas'] })
  }

  const updateMutation   = useMutation({ mutationFn: (p: { title?: string; description?: string; flagKey?: string | null }) => updateFeatureIdea(ideaId, p), onSuccess: invalidateAll })
  const stageMutation    = useMutation({ mutationFn: (stage: IdeaStage) => setIdeaStage(ideaId, stage), onSuccess: invalidateAll })
  const triageMutation   = useMutation({ mutationFn: (p: { kanGoras: boolean | null; borGoras: boolean | null; motivering: string | null }) => setIdeaTriage(ideaId, p.kanGoras, p.borGoras, p.motivering), onSuccess: invalidateAll })
  const addTesterMutation = useMutation({ mutationFn: (email: string) => addIdeaTester(ideaId, email), onSuccess: invalidateAll })
  const removeTesterMutation = useMutation({ mutationFn: (userId: string) => removeIdeaTester(ideaId, userId), onSuccess: invalidateAll })
  const addChecklistMutation = useMutation({ mutationFn: (label: string) => addChecklistItem(ideaId, label), onSuccess: invalidateAll })
  const toggleChecklistMutation = useMutation({ mutationFn: (p: { itemId: string; done: boolean }) => toggleChecklistItem(ideaId, p.itemId, p.done), onSuccess: invalidateAll })
  const removeChecklistMutation = useMutation({ mutationFn: (itemId: string) => removeChecklistItem(ideaId, itemId), onSuccess: invalidateAll })
  const deleteMutation   = useMutation({ mutationFn: () => deleteFeatureIdea(ideaId), onSuccess: () => { invalidateAll(); onClose() } })

  const [redigerar, setRedigerar]     = useState(false)
  const [titel, setTitel]             = useState('')
  const [beskrivning, setBeskrivning] = useState('')
  const [flagKey, setFlagKey]         = useState('')
  const [motivering, setMotivering]   = useState('')
  const [visaTesterForm, setVisaTesterForm] = useState(false)
  const [testerEpost, setTesterEpost] = useState('')
  const [testerFel, setTesterFel]     = useState<string | null>(null)
  const [visaChecklistForm, setVisaChecklistForm] = useState(false)
  const [nyttChecklistItem, setNyttChecklistItem] = useState('')

  // Ett klick på en idé ska aldrig ge "ingenting": vid laddning/fel visas en modal med besked.
  if (!data) {
    return createPortal(
      <div
        className="fixed inset-0 z-[8500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <p className="text-base font-semibold text-slate-800">Idé</p>
            <button onClick={onClose} aria-label="Stäng" className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          <div className="px-6 py-8">
            {ideFråga.isError ? (
              <HamtningsFel
                fel={ideFråga.error}
                reserv="Kunde inte hämta idén."
                onForsokIgen={() => { void ideFråga.refetch() }}
                arIgang={ideFråga.isFetching}
              />
            ) : (
              <p className="text-center text-sm text-slate-400">Laddar idén...</p>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  }
  const { idea, testers, checklist } = data

  const länkadFlagg = idea.flagKey ? FLAG_DEFINITIONER.find(f => f.key === idea.flagKey) : undefined
  const flaggDagar   = länkadFlagg?.roadmapSedan ? dagarSedan(länkadFlagg.roadmapSedan) : null

  function börjaRedigera() {
    setTitel(idea.title)
    setBeskrivning(idea.description)
    setFlagKey(idea.flagKey ?? '')
    setRedigerar(true)
  }

  // Redigeringsläget stängs först när servern bekräftat (V3-8) — vid fel finns texten kvar.
  function sparaRedigering() {
    if (updateMutation.isPending) return
    updateMutation.mutate(
      { title: titel.trim(), description: beskrivning, flagKey: flagKey.trim() || null },
      { onSuccess: () => setRedigerar(false) },
    )
  }

  function sparaTriage(kanGoras: boolean | null, borGoras: boolean | null) {
    triageMutation.mutate({ kanGoras, borGoras, motivering: motivering.trim() || idea.triageMotivering || null })
  }

  async function läggTillTester() {
    setTesterFel(null)
    try {
      await addTesterMutation.mutateAsync(testerEpost.trim())
      setTesterEpost('')
      setVisaTesterForm(false)
    } catch (fel) {
      setTesterFel(visaFel(fel, 'Ingen användare hittades med den e-posten, eller är redan testare.'))
    }
  }

  // Fel från övriga åtgärder (stadie, triage, ta bort testare, checklista, radera).
  const åtgärdsFel = stageMutation.error ?? triageMutation.error ?? removeTesterMutation.error
    ?? toggleChecklistMutation.error ?? removeChecklistMutation.error ?? deleteMutation.error
  const nyttItemLås = addChecklistMutation.isPending

  return createPortal(
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-mono text-xs text-slate-400">#{idea.ideaNumber}</span>
            {redigerar ? (
              <input
                value={titel} onChange={e => setTitel(e.target.value)}
                className="text-base font-semibold text-slate-800 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-400"
              />
            ) : (
              <p className="text-base font-semibold text-slate-800 leading-snug">{idea.title}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl shrink-0 mt-0.5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          <MutationFel fel={åtgärdsFel} reserv="Ändringen kunde inte sparas. Försök igen." className="bg-red-50 border border-red-200 rounded-xl px-4 py-3" />

          {/* Stadie-växlare */}
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Stadie</p>
            <div className="flex gap-1.5 flex-wrap">
              {STAGE_ORDER.map(s => (
                <button
                  key={s}
                  onClick={() => stageMutation.mutate(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    idea.stage === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Beskrivning + flagga */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Beskrivning</p>
              {!redigerar && (
                <button onClick={börjaRedigera} className="text-xs text-violet-600 hover:text-violet-500 font-medium">Redigera</button>
              )}
            </div>
            {redigerar ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={beskrivning} onChange={e => setBeskrivning(e.target.value)} rows={4}
                  className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400 resize-none"
                />
                <input
                  value={flagKey} onChange={e => setFlagKey(e.target.value)}
                  placeholder="Feature flag-nyckel (t.ex. flode_sparat), valfritt"
                  className="text-xs font-mono text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                />
                <MutationFel fel={updateMutation.error} reserv="Idén kunde inte sparas. Din text finns kvar — försök igen." className="text-xs" />
                <div className="flex gap-2">
                  <button onClick={sparaRedigering} disabled={updateMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">{updateMutation.isPending ? 'Sparar...' : 'Spara'}</button>
                  <button onClick={() => setRedigerar(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{idea.description || '—'}</p>
                {idea.flagKey && (
                  länkadFlagg?.roadmap ? (
                    <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-slate-500">{idea.flagKey}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Väntar på lansering</span>
                        {flaggDagar !== null && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            flaggDagar >= VÄNTAT_VARNING_DAGAR ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            Väntat {flaggDagar} {flaggDagar === 1 ? 'dag' : 'dagar'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{länkadFlagg.roadmap}</p>
                      {länkadFlagg.roadmapPrNummer && länkadFlagg.roadmapPrNummer.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {länkadFlagg.roadmapPrNummer.map(pr => (
                            <a
                              key={pr}
                              href={`${GITHUB_REPO}/pull/${pr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                            >
                              PR #{pr}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-slate-400 mt-2">Flagga: {idea.flagKey}</p>
                  )
                )}
              </>
            )}
            {idea.sourceTicketId && (
              <p className="text-xs text-slate-400 mt-2">
                Källa: Feedback-ärende{' '}
                {onÖppnaÄrende ? (
                  <button onClick={() => onÖppnaÄrende(idea.sourceTicketId!)} className="text-violet-600 hover:text-violet-500 font-medium">
                    öppna →
                  </button>
                ) : idea.sourceTicketId}
              </p>
            )}
          </div>

          {/* Triage */}
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Triage</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={idea.triageKanGoras ?? false} onChange={e => sparaTriage(e.target.checked, idea.triageBorGoras ?? null)} className="rounded border-slate-300 text-violet-600" />
                Kan göras
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={idea.triageBorGoras ?? false} onChange={e => sparaTriage(idea.triageKanGoras ?? null, e.target.checked)} className="rounded border-slate-300 text-violet-600" />
                Bör göras
              </label>
            </div>
            <textarea
              defaultValue={idea.triageMotivering ?? ''}
              onChange={e => setMotivering(e.target.value)}
              onBlur={() => sparaTriage(idea.triageKanGoras ?? null, idea.triageBorGoras ?? null)}
              placeholder="Motivering..."
              rows={2}
              className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>

          {/* Testare */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Testare</p>
              <button onClick={() => setVisaTesterForm(v => !v)} className="text-xs text-violet-600 hover:text-violet-500 font-medium">+ Lägg till</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {testers.map(t => (
                <div key={t.userId} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-slate-700">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.email}</p>
                  </div>
                  <button onClick={() => removeTesterMutation.mutate(t.userId)} className="text-xs text-slate-400 hover:text-red-500">Ta bort</button>
                </div>
              ))}
              {testers.length === 0 && <p className="text-xs text-slate-400">Inga testare tillagda.</p>}
            </div>
            {visaTesterForm && (
              <div className="flex flex-col gap-2 mt-2">
                <input
                  value={testerEpost} onChange={e => setTesterEpost(e.target.value)}
                  placeholder="E-postadress"
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                />
                {testerFel && <p role="alert" className="text-xs text-red-500">{testerFel}</p>}
                <div className="flex gap-2">
                  <button onClick={läggTillTester} disabled={!testerEpost.trim() || addTesterMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Lägg till</button>
                  <button onClick={() => { setVisaTesterForm(false); setTesterFel(null) }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                </div>
              </div>
            )}
          </div>

          {/* Checklista */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Lanseringschecklista</p>
              <button onClick={() => setVisaChecklistForm(v => !v)} className="text-xs text-violet-600 hover:text-violet-500 font-medium">+ Eget item</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {checklist.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 flex-1 min-w-0">
                    <input
                      type="checkbox" checked={c.done}
                      onChange={e => toggleChecklistMutation.mutate({ itemId: c.id, done: e.target.checked })}
                      className="rounded border-slate-300 text-violet-600 shrink-0"
                    />
                    <span className={c.done ? 'line-through text-slate-400' : ''}>{c.label}</span>
                  </label>
                  <button onClick={() => removeChecklistMutation.mutate(c.id)} className="text-xs text-slate-300 hover:text-red-500 shrink-0">✕</button>
                </div>
              ))}
              {checklist.length === 0 && <p className="text-xs text-slate-400">Ingen checklista än — läggs till automatiskt när stadiet sätts till Lanseringsklar.</p>}
            </div>
            {visaChecklistForm && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex gap-2">
                  <input
                    value={nyttChecklistItem} onChange={e => setNyttChecklistItem(e.target.value)}
                    placeholder="Ny checklista-punkt"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                  />
                  <button
                    onClick={() => {
                      if (addChecklistMutation.isPending) return
                      // Fältet töms och formuläret stängs först när servern bekräftat.
                      addChecklistMutation.mutate(nyttChecklistItem.trim(), {
                        onSuccess: () => { setNyttChecklistItem(''); setVisaChecklistForm(false) },
                      })
                    }}
                    disabled={!nyttChecklistItem.trim() || nyttItemLås}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {nyttItemLås ? 'Lägger till...' : 'Lägg till'}
                  </button>
                </div>
                <MutationFel fel={addChecklistMutation.error} reserv="Punkten kunde inte läggas till. Din text finns kvar — försök igen." className="text-xs" />
              </div>
            )}
          </div>

          {/* Radera */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => { if (confirm('Radera den här idén permanent?')) deleteMutation.mutate() }}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              Radera idé
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}
