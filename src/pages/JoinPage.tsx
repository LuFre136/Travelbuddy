import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { requireSupabase } from '../lib/supabase'
import { roleLabels, type TripRole } from '../lib/types'
import { Button, ErrorText } from '../components/ui'

interface Preview {
  trip_id: string
  trip_title: string
  role: TripRole
  valid: boolean
}

export function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    requireSupabase()
      .rpc('invite_preview', { p_token: token })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPreview((data as Preview[])[0] ?? null)
      })
  }, [token])

  async function join() {
    setBusy(true)
    setError(null)
    const { data, error } = await requireSupabase().rpc('accept_invite', { p_token: token })
    setBusy(false)
    if (error) setError(error.message)
    else navigate(`/trips/${data}`, { replace: true })
  }

  if (preview === undefined && !error) return <p className="text-sm text-slate-500">Lädt …</p>

  if (!preview || !preview.valid) {
    return (
      <div className="mx-auto max-w-sm space-y-2 pt-8">
        <h1 className="text-xl font-semibold">Einladung ungültig</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Der Link ist abgelaufen, wurde zurückgezogen oder schon zu oft benutzt. Bitte frag nach einem neuen Link.
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-xl font-semibold">Einladung zu „{preview.trip_title}“</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">Du trittst als {roleLabels[preview.role]} bei.</p>
      <Button type="button" onClick={join} disabled={busy}>
        Reise beitreten
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
