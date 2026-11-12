import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from '../components/Auth/GoogleSignInButton'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-violet-600">Samhällsinfo</span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Logga in på ditt konto</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                E-post
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.se"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Lösenord
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-violet-600 hover:text-violet-500"
                >
                  Glömt lösenordet?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors mt-1"
            >
              {loading ? 'Loggar in…' : 'Logga in'}
            </button>
          </form>

          <div className="mt-5">
            <GoogleSignInButton
              onStart={() => {
                setError(null)
                setLoading(true)
              }}
              onError={(message) => {
                setError(message)
                setLoading(false)
              }}
              onSuccess={() => {
                navigate(redirect, { replace: true })
              }}
            />
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
          Inget konto?{' '}
          <Link
            to={`/register${redirect !== '/' ? `?redirect=${redirect}` : ''}`}
            className="text-violet-600 hover:text-violet-500 font-medium"
          >
            Skapa ett här
          </Link>
        </p>

        <p className="text-center text-xs text-slate-400 mt-4">
          Samhällsinformation — opartisk myndighetsinformation
        </p>
      </div>
    </div>
  )
}
