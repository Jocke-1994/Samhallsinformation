import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMe, updateDisplayName } from '../../../api/auth'
import { inputClass } from './kontoTypes'

// Bara relevant för Admin/Support — vanliga användare svarar aldrig på
// ärenden och har inget att sätta här. Visningsnamnet ersätter den
// generiska etiketten "Support" i supportsvar till slutanvändare (se
// SupportController.GetMyTicket) — avslöjar aldrig kontots riktiga Name.
export default function SupportVisningsnamnKort() {
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const [värde, setVärde] = useState('')
  const [sparat, setSparat] = useState(false)

  useEffect(() => {
    if (me) setVärde(me.displayName ?? '')
  }, [me])

  const mutation = useMutation({
    mutationFn: () => updateDisplayName(värde.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setSparat(true)
      setTimeout(() => setSparat(false), 2500)
    },
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🎫</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Visningsnamn för supportsvar</h2>
            <p className="text-sm text-slate-500 mt-0.5">Visas för användare istället för "Support"</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visningsnamn</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={värde}
            onChange={e => setVärde(e.target.value)}
            placeholder="T.ex. ditt förnamn eller ett smeknamn"
            className={inputClass}
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow shrink-0"
          >
            {mutation.isPending ? 'Sparar…' : 'Spara'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Lämna tomt för att visa den generiska etiketten "Support" istället. Ditt riktiga namn visas aldrig för användaren.
        </p>
        {mutation.isError && (
          <p className="text-xs text-red-500 font-medium">{(mutation.error as Error).message}</p>
        )}
        {sparat && <p className="text-xs text-green-600 font-medium">✓ Sparat</p>}
      </div>
    </div>
  )
}
