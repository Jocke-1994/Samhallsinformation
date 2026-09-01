import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createTicket } from '../../api/support'

type Status = 'idle' | 'sending' | 'success' | 'error'

interface Props {
  open: boolean
  onClose: () => void
}

export function FeedbackModal({ open, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [villHaÅterkoppling, setVillHaÅterkoppling] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      await createTicket({
        message,
        channel: 'feedback',
        contactName: villHaÅterkoppling ? name : undefined,
        contactEmail: villHaÅterkoppling ? email : undefined,
      })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  function handleClose() {
    onClose()
    setMessage('')
    setVillHaÅterkoppling(false)
    setName('')
    setEmail('')
    setStatus('idle')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[8500] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Lämna feedback
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Stäng"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Tack för din feedback!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Vi läser allt och jobbar ständigt på att förbättra tjänsten.</p>
            <button
              onClick={handleClose}
              className="mt-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Stäng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Meddelande <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Vad tänker du på? Bugg, förbättringsförslag, eller bara en tanke..."
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={villHaÅterkoppling}
                onChange={e => setVillHaÅterkoppling(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Jag vill ha återkoppling
              </span>
            </label>

            {villHaÅterkoppling && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Namn <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ditt namn"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    E-post <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="din@email.se"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </>
            )}

            {status === 'error' && (
              <p className="text-xs text-red-500">Något gick fel. Försök igen eller kontakta oss direkt.</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full text-sm font-medium py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white transition-colors"
            >
              {status === 'sending' ? 'Skickar...' : 'Skicka feedback'}
            </button>
          </form>
        )}

      </div>
    </div>,
    document.body
  )
}
