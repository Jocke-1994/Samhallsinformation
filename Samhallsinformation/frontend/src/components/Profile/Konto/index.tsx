import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import { makeField, type FormField } from './kontoTypes'
import { fetchMe, updateMyProfile, requestEmailChange, cancelEmailChange } from '../../../api/auth'
import KontoInfo from './KontoInfo'
import SparSamtycke from './SparSamtycke'
import ThemeKort from './ThemeKort'
import PushKort from './PushKort'
import AktivitetsloggKort from './AktivitetsloggKort'
import SessionerKort from './SessionerKort'
import TvafaktorKort from './TvafaktorKort'
import LösenordByte from './LösenordByte'
import Datahantering from './Datahantering'
import SupportVisningsnamnKort from './SupportVisningsnamnKort'
import { useFlags } from '../../../context/FeatureFlagsContext'
import { useAuth } from '../../../context/AuthContext'
import { visaFel } from '../../../lib/felmeddelande'

export default function Konto() {
  const [namn, setNamn] = useState<FormField>(makeField(''))
  const [epost, setEpost] = useState<FormField>(makeField(''))
  // Kontots FAKTISKA, bekräftade adress — skild från epost.value (inmatningsfältets
  // innehåll) eftersom ett e-postbyte inte slår igenom förrän länken i mejlet klickas.
  const [accountEmail, setAccountEmail] = useState('')
  const [authProvider, setAuthProvider] = useState('local')
  // Lösenordskortet väntar på /me-svaret — annars skulle det blinka fram för
  // Google-konton (authProvider defaultar till 'local' tills svaret kommit).
  const [meLaddad, setMeLaddad] = useState(false)
  const [emailPassword, setEmailPassword] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [laddningsfel, setLaddningsfel] = useState(false)
  // Ett skrivande anrop i taget i Kontouppgifter (namn/e-postbyte): knapparna
  // låses medan det pågår, så ett dubbeltryck inte ger två mejl eller en 429.
  const [sparar, setSparar] = useState(false)
  const location = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)
  const flaggor = useFlags()
  const { roll, setAccessToken } = useAuth()
  const ärSupportEllerAdmin = roll === 'Admin' || roll === 'Support'

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), 4200)
    return () => clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    let avbruten = false
    fetchMe()
      .then((data) => {
        if (avbruten) return
        setNamn({ value: data.name, saved: true, error: '' })
        setEpost({ value: data.email, saved: true, error: '' })
        setAccountEmail(data.email)
        setAuthProvider(data.authProvider)
        setPendingEmail(data.pendingEmail)
        setMeLaddad(true)
      })
      .catch(() => {
        if (!avbruten) setLaddningsfel(true)
      })
    return () => {
      avbruten = true
    }
  }, [])

  function update(setter: React.Dispatch<React.SetStateAction<FormField>>, value: string) {
    setter((prev) => ({ ...prev, value, saved: false, error: '' }))
  }

  async function saveField(
    setter: React.Dispatch<React.SetStateAction<FormField>>,
    value: string,
    field: 'name',
    validate: () => string,
  ) {
    if (sparar) return
    const err = validate()
    if (err) {
      setter((prev) => ({ ...prev, error: err, saved: false }))
      return
    }
    setSparar(true)
    try {
      const res = await updateMyProfile({ [field]: value })
      setAccessToken(res.accessToken)
      setter((prev) => ({ ...prev, saved: true, error: '' }))
    } catch (e) {
      setter((prev) => ({
        ...prev,
        error: visaFel(e, 'Namnet kunde inte sparas. Försök igen.'),
        saved: false,
      }))
    } finally {
      setSparar(false)
    }
  }

  async function handleRequestEmailChange() {
    if (sparar) return
    const value = epost.value.trim()
    if (!value.includes('@')) {
      setEpost((prev) => ({ ...prev, error: 'Ange en giltig e-postadress.', saved: false }))
      return
    }
    if (authProvider === 'local' && !emailPassword) {
      setEpost((prev) => ({
        ...prev,
        error: 'Ange ditt lösenord för att bekräfta bytet.',
        saved: false,
      }))
      return
    }
    setSparar(true)
    try {
      await requestEmailChange(value, emailPassword || undefined)
      setPendingEmail(value)
      setEmailPassword('')
      setEpost((prev) => ({ ...prev, error: '' }))
    } catch (e) {
      setEpost((prev) => ({
        ...prev,
        error: visaFel(e, 'Bekräftelsen kunde inte skickas. Försök igen om en stund.'),
        saved: false,
      }))
    } finally {
      setSparar(false)
    }
  }

  async function handleCancelEmailChange() {
    if (sparar) return
    setSparar(true)
    try {
      await cancelEmailChange()
      setPendingEmail(null)
      setEpost((prev) => ({ ...prev, error: '' }))
    } catch {
      // Bannern ligger kvar (bytet är fortfarande aktivt), så felet måste synas.
      setEpost((prev) => ({
        ...prev,
        error: 'Bytet kunde inte avbrytas. Försök igen.',
        saved: false,
      }))
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Avatar + namn-banner */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl px-8 py-8 flex items-center gap-6 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold shrink-0 backdrop-blur-sm">
          {namn.value ? namn.value[0].toUpperCase() : 'JO'}
        </div>
        <div>
          <p className="text-white text-xl font-bold tracking-tight">{namn.value || 'Ditt namn'}</p>
          <p className="text-violet-200 text-sm mt-0.5">{accountEmail || 'din@epost.se'}</p>
        </div>
      </div>

      {laddningsfel && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Kunde inte ladda dina kontouppgifter. Prova att ladda om sidan.
        </div>
      )}

      {/* Tvåkolumns grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Vänster kolumn */}
        <div className="flex flex-col gap-6">
          {flaggor.konto_info && (
            <KontoInfo
              namn={namn}
              epost={epost}
              pendingEmail={pendingEmail}
              requiresPassword={authProvider === 'local'}
              sparar={sparar}
              emailPassword={emailPassword}
              onUpdateNamn={(value) => update(setNamn, value)}
              onUpdateEpost={(value) => update(setEpost, value)}
              onSaveNamn={() =>
                saveField(setNamn, namn.value.trim(), 'name', () =>
                  namn.value.trim() ? '' : 'Ange ett namn.',
                )
              }
              onUpdateEmailPassword={setEmailPassword}
              onRequestEmailChange={handleRequestEmailChange}
              onCancelEmailChange={handleCancelEmailChange}
            />
          )}
          {flaggor.konto_losenord && meLaddad && (
            <LösenordByte harLosenord={authProvider === 'local'} />
          )}
          {flaggor.konto_visningsnamn && ärSupportEllerAdmin && <SupportVisningsnamnKort />}
          {flaggor.konto_tvafaktor && <TvafaktorKort harTelefon={false} />}
          {flaggor.konto_samtycke && <SparSamtycke />}
        </div>

        {/* Höger kolumn */}
        <div className="flex flex-col gap-6">
          {flaggor.konto_tema && <ThemeKort />}
          {flaggor.notif_push && <PushKort />}
          {flaggor.konto_sessioner && <SessionerKort />}
          {flaggor.konto_aktivitetslogg && <AktivitetsloggKort />}
          {flaggor.konto_datahantering && <Datahantering highlightId={highlightId} />}
        </div>
      </div>
    </div>
  )
}
