import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchFeatureIdeas, createFeatureIdea, type IdeaStage, type FeatureIdeaListItemDto } from '../../api/featureIdeas'
import IdeDetaljModal from './IdeDetaljModal'
import { HamtningsFel, MutationFel } from '../common/HamtningsStatus'

export const STAGE_LABELS: Record<IdeaStage, string> = {
  brainstorm:     'Brainstorm',
  triage:         'Triage',
  byggs:          'Bygger',
  testas:         'Testar',
  lanseringsklar: 'Lanseringsklar',
  lanserad:       'Lanserad',
  avfärdad:       'Avfärdad',
}

export const STAGE_ORDER: IdeaStage[] = ['brainstorm', 'triage', 'byggs', 'testas', 'lanseringsklar', 'lanserad', 'avfärdad']

const STAGE_PILL: Record<IdeaStage, string> = {
  brainstorm:     'bg-slate-100 text-slate-600',
  triage:         'bg-amber-100 text-amber-700',
  byggs:          'bg-sky-100 text-sky-700',
  testas:         'bg-violet-100 text-violet-700',
  lanseringsklar: 'bg-emerald-100 text-emerald-700',
  lanserad:       'bg-green-100 text-green-700',
  avfärdad:       'bg-red-100 text-red-700',
}

type Flik = 'alla' | IdeaStage | 'avslutade'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function idéMatcharFlik(idé: FeatureIdeaListItemDto, flik: Flik): boolean {
  if (flik === 'alla') return true
  if (flik === 'avslutade') return idé.stage === 'lanserad' || idé.stage === 'avfärdad'
  return idé.stage === flik
}

interface Props {
  onÖppnaÄrende?: (ticketId: string) => void
}

export default function FunktionsIdePipeline({ onÖppnaÄrende }: Props) {
  const [flik, setFlik]           = useState<Flik>('alla')
  const [öppenId, setÖppenId]     = useState<string | null>(null)
  const [visaNyForm, setVisaForm] = useState(false)
  const [nyTitel, setNyTitel]     = useState('')
  const [nyBeskrivning, setNyBeskrivning] = useState('')

  const queryClient = useQueryClient()
  const idéFråga = useQuery({ queryKey: ['feature-ideas'], queryFn: () => fetchFeatureIdeas() })
  const idéer = idéFråga.data ?? []
  const idéerOkända = idéFråga.data === undefined
  const skapaLås = useRef(false) // ref: react-query meddelar asynkront, så isPending stoppar inte två klick i samma tick

  const createMutation = useMutation({
    mutationFn: () => createFeatureIdea({ title: nyTitel.trim(), description: nyBeskrivning.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-ideas'] })
      setVisaForm(false)
      setNyTitel('')
      setNyBeskrivning('')
    },
  })

  const filtrerade = idéer.filter(i => idéMatcharFlik(i, flik))

  const flikar: [Flik, string][] = [
    ['alla', 'Alla'],
    ['brainstorm', STAGE_LABELS.brainstorm],
    ['triage', STAGE_LABELS.triage],
    ['byggs', STAGE_LABELS.byggs],
    ['testas', STAGE_LABELS.testas],
    ['lanseringsklar', STAGE_LABELS.lanseringsklar],
    ['avslutade', 'Avslutade'],
  ]

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
          {flikar.map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFlik(val)}
              className={`text-xs px-4 py-1.5 rounded-md font-medium transition-colors ${
                flik === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setVisaForm(v => !v)}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          + Ny idé
        </button>
      </div>

      {visaNyForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
          <input
            value={nyTitel} onChange={e => setNyTitel(e.target.value)}
            placeholder="Titel på idén"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-violet-400"
          />
          <textarea
            value={nyBeskrivning} onChange={e => setNyBeskrivning(e.target.value)}
            placeholder="Beskrivning (valfritt)"
            rows={3}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-violet-400 resize-none"
          />
          <MutationFel fel={createMutation.error} reserv="Idén kunde inte skapas. Din text finns kvar — försök igen." />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (skapaLås.current) return
                skapaLås.current = true
                createMutation.mutate(undefined, { onSettled: () => { skapaLås.current = false } })
              }}
              disabled={!nyTitel.trim() || createMutation.isPending}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {createMutation.isPending ? 'Skapar...' : 'Skapa idé'}
            </button>
            <button
              onClick={() => setVisaForm(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="pl-5 pr-3 py-3 w-20 text-xs font-medium text-slate-500 uppercase tracking-wide">Idé</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Titel</th>
                <th className="px-4 py-3 w-40 text-xs font-medium text-slate-500 uppercase tracking-wide">Stadie</th>
                <th className="px-4 py-3 w-28 text-xs font-medium text-slate-500 uppercase tracking-wide">Källa</th>
                <th className="pl-4 pr-5 py-3 w-28 text-xs font-medium text-slate-500 uppercase tracking-wide">Uppdaterad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrerade.map(i => (
                <tr key={i.id} onClick={() => setÖppenId(i.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                  <td className="pl-5 pr-3 py-4 font-mono text-xs text-slate-400">#{i.ideaNumber}</td>
                  <td className="px-4 py-4 text-slate-700 font-medium">{i.title}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap ${STAGE_PILL[i.stage]}`}>{STAGE_LABELS[i.stage]}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{i.källaTyp === 'feedback' ? 'Feedback' : 'Admin'}</span>
                  </td>
                  <td className="pl-4 pr-5 py-4 text-slate-400 text-xs">{formatDate(i.updatedAt)}</td>
                </tr>
              ))}
              {idéFråga.isLoading && (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-slate-400">Laddar idéer...</td></tr>
              )}
              {idéFråga.isError && (
                <tr><td colSpan={5} className="p-0">
                  <HamtningsFel
                    fel={idéFråga.error}
                    reserv={idéerOkända ? 'Kunde inte hämta idéerna. Det här är inte samma sak som att inga idéer finns.' : 'Kunde inte uppdatera listan. Den kan vara inaktuell.'}
                    onForsokIgen={() => { void idéFråga.refetch() }}
                    arIgang={idéFråga.isFetching}
                    className="py-12"
                  />
                </td></tr>
              )}
              {!idéFråga.isLoading && !idéerOkända && filtrerade.length === 0 && (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-slate-400">Inga idéer i det här läget.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {öppenId && <IdeDetaljModal ideaId={öppenId} onClose={() => setÖppenId(null)} onÖppnaÄrende={onÖppnaÄrende} />}
    </div>
  )
}
