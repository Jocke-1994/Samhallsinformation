import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { verifyEmail } from '../api/auth'
import { useAuth } from '../context/AuthContext'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { isLoggedIn, refreshSession } = useAuth()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error')
  const [error, setError]   = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true
    verifyEmail(token)
      .then(async () => {
        // Backend-statusen är nu uppdaterad, men en redan inloggad sessions token
        // har fortfarande den gamla emailVerified-claimen inbakad — hämta en ny.
        if (isLoggedIn) await refreshSession()
        setStatus('success')
        setTimeout(() => navigate('/', { replace: true }), 3000)
      })
      .catch(err => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Något gick fel')
      })
  }, [token, navigate, isLoggedIn, refreshSession])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-violet-600">Samhällsinfo</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
          {status === 'verifying' && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Bekräftar din e-postadress…</p>
          )}
          {status === 'success' && (
            <>
              <div className="text-3xl mb-4">✅</div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">E-postadressen är bekräftad!</p>
              <p className="text-xs text-slate-400 mt-2">Du skickas vidare…</p>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {error ?? 'Länken är ogiltig eller har gått ut.'}
              </p>
              <Link to="/" className="text-violet-600 hover:text-violet-500 text-sm mt-3 inline-block">
                Till startsidan
              </Link>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
