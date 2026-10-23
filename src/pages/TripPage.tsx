import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { ErrorText, TextButton } from '../components/ui'
import { formatDateRange } from '../lib/format'
import { loadPlan, type TripPlan } from '../lib/plan'
import { requireSupabase } from '../lib/supabase'
import { canEditPlan, roleLabels, type Trip } from '../lib/types'
import { ActivitiesTab } from './trip/ActivitiesTab'
import { EditTripForm } from './trip/EditTripForm'
import { MapTab } from './trip/MapTab'
import { MembersTab, type Member } from './trip/MembersTab'
import { PlanTab } from './trip/PlanTab'
import { StaysTab } from './trip/StaysTab'
import { TransfersTab } from './trip/TransfersTab'

const tabs = [
  { key: 'plan', label: 'Plan' },
  { key: 'stays', label: 'Unterkünfte' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'activities', label: 'Aktivitäten' },
  { key: 'map', label: 'Karte' },
  { key: 'members', label: 'Mitreisende' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function TripPage() {
  const { tripId } = useParams()
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: TabKey = tabs.some((t) => t.key === params.get('tab')) ? (params.get('tab') as TabKey) : 'plan'
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [plan, setPlan] = useState<TripPlan>({ stays: [], transfers: [], activities: [] })
  const [error, setError] = useState<string | null>(null)
  const [editingTrip, setEditingTrip] = useState(false)

  const reload = useCallback(async () => {
    if (!tripId) return
    const db = requireSupabase()
    try {
      const [tripRes, membersRes, planData] = await Promise.all([
        db.from('trips').select('id, title, description, start_date, end_date').eq('id', tripId).maybeSingle(),
        db
          .from('trip_members')
          .select('user_id, role, profiles(display_name)')
          .eq('trip_id', tripId)
          .order('joined_at'),
        loadPlan(tripId),
      ])
      const dbError = tripRes.error ?? membersRes.error
      if (dbError) throw new Error(dbError.message)
      if (!tripRes.data) throw new Error('Diese Reise gibt es nicht oder du bist kein Mitglied.')
      setTrip(tripRes.data)
      setMembers(membersRes.data as unknown as Member[])
      setPlan(planData)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [tripId])

  useEffect(() => {
    reload()
  }, [reload])

  if (error && !trip) return <ErrorText>{error}</ErrorText>
  if (!trip) return <p className="text-sm text-slate-500">Lädt …</p>

  const myRole = members.find((m) => m.user_id === session?.user.id)?.role
  const canEdit = canEditPlan(myRole)
  const tabProps = { trip, plan, canEdit, reload }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/" className="text-sm text-brand-700 hover:underline dark:text-brand-100">
          ← Meine Reisen
        </Link>
        <h1 className="text-2xl font-semibold">{trip.title}</h1>
        <p className="text-sm text-slate-500">
          {formatDateRange(trip.start_date, trip.end_date)}
          {myRole && ` · du bist ${roleLabels[myRole]}`}
          {myRole === 'host' && !editingTrip && (
            <>
              {' · '}
              <TextButton onClick={() => setEditingTrip(true)}>Reise bearbeiten</TextButton>
            </>
          )}
        </p>
      </div>

      {editingTrip && (
        <EditTripForm
          trip={trip}
          onDone={async (saved) => {
            setEditingTrip(false)
            if (saved) await reload()
          }}
        />
      )}

      <nav aria-label="Bereiche der Reise" className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1 border-b border-slate-200 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={tab === t.key ? 'page' : undefined}
              onClick={() => setParams(t.key === 'plan' ? {} : { tab: t.key }, { replace: true })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
                tab === t.key
                  ? 'border-brand-600 font-medium text-brand-700 dark:text-brand-100'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {!canEdit && tab !== 'members' && (
        <p className="text-sm text-slate-500">
          Als Travelbuddy siehst du den Plan. Ändern können ihn Host und Travelguides. Vorschläge kommen bald.
        </p>
      )}

      {tab === 'plan' && <PlanTab {...tabProps} />}
      {tab === 'stays' && <StaysTab {...tabProps} />}
      {tab === 'transfers' && <TransfersTab {...tabProps} />}
      {tab === 'activities' && <ActivitiesTab {...tabProps} />}
      {tab === 'map' && <MapTab {...tabProps} />}
      {tab === 'members' && (
        <MembersTab tripId={trip.id} members={members} myUserId={session?.user.id} myRole={myRole} />
      )}

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
