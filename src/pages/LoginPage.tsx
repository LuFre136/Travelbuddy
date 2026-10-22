import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { requireSupabase } from '../lib/supabase'
import { Button, ErrorText, Input, SecondaryButton } from '../components/ui'

function safeNext(value: string | null): string {
  // Nur interne Pfade zulassen, damit der Login-Link nicht auf fremde Seiten umleitet.
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function LoginPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={next} replace />

  const redirectTo = `${window.location.origin}${next}`

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await requireSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function signInWithGoogle() {
    setError(null)
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Plane Reisen gemeinsam mit deinen Travelbuddies.</p>
      </div>

      {sent ? (
        <p className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-800/30 dark:text-brand-100">
          Wir haben dir einen Anmeldelink an <strong>{email}</strong> geschickt. Öffne ihn auf diesem Gerät.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">
            E-Mail
          </label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@beispiel.de"
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Wird gesendet …' : 'Anmeldelink senden'}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        oder
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <SecondaryButton type="button" onClick={signInWithGoogle} className="w-full">
        Mit Google anmelden
      </SecondaryButton>

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
