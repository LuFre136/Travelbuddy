import { useState } from 'react'
import { Button, ErrorText } from '../../components/ui'
import { inviteUrl } from '../../lib/format'
import { requireSupabase } from '../../lib/supabase'
import { canEditPlan, roleLabels, type TripRole } from '../../lib/types'

export interface Member {
  user_id: string
  role: TripRole
  profiles: { display_name: string } | null
}

export function MembersTab({
  tripId,
  members,
  myUserId,
  myRole,
}: {
  tripId: string
  members: Member[]
  myUserId: string | undefined
  myRole: TripRole | undefined
}) {
  const [inviteRole, setInviteRole] = useState<'buddy' | 'guide'>('buddy')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isHost = myRole === 'host'

  async function createInvite() {
    setError(null)
    setCopied(false)
    const { data, error } = await requireSupabase()
      .from('invites')
      .insert({ trip_id: tripId, role: isHost ? inviteRole : 'buddy' })
      .select('token')
      .single()
    if (error) setError(error.message)
    else setLink(inviteUrl(window.location.origin, data.token))
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              {m.profiles?.display_name || 'Unbekannt'}
              {m.user_id === myUserId && ' (du)'}
            </span>
            <span className="text-slate-500">{roleLabels[m.role]}</span>
          </li>
        ))}
      </ul>

      {canEditPlan(myRole) && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold">Einladen</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Der Link ist 14 Tage gültig. Wer ihn öffnet und sich anmeldet, tritt der Reise bei.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isHost && (
              <select
                id="invite-role"
                aria-label="Rolle für Eingeladene"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'buddy' | 'guide')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="buddy">als Travelbuddy</option>
                <option value="guide">als Travelguide</option>
              </select>
            )}
            <Button type="button" onClick={createInvite}>
              Einladungslink erstellen
            </Button>
          </div>
          {link && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
                {link}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="text-sm text-brand-700 hover:underline dark:text-brand-100"
              >
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          )}
        </section>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
