import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { requireSupabase } from '../lib/supabase'
import { formatDateRange } from '../lib/format'
import { roleLabels, type Trip, type TripRole } from '../lib/types'
import { useAuth } from '../auth/context'
import { Button, ErrorText, Input } from '../components/ui'
import { DateRangePicker, type DayRange } from '../components/DateRangePicker'

type TripRow = Trip & { trip_members: { role: TripRole }[] }

export function TripsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [range, setRange] = useState<DayRange>({ start: null, end: null })
  const [busy, setBusy] = useState(false)

  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await requireSupabase()
      .from('trips')
      .select('id, title, description, start_date, end_date, trip_members!inner(role)')
      .eq('trip_members.user_id', userId)
      .order('start_date', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    else setTrips(data as TripRow[])
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function createTrip(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    // Ohne .select(): Postgres prüft beim Zurücklesen die Lese-Regel, bevor der
    // Trigger den Ersteller als Host einträgt. Die ID erzeugen wir deshalb selbst.
    const id = crypto.randomUUID()
    const { error } = await requireSupabase()
      .from('trips')
      .insert({ id, title: title.trim(), start_date: range.start, end_date: range.end })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/trips/${id}`)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Meine Reisen</h1>
        {trips === null && !error && <p className="text-sm text-slate-500">Lädt …</p>}
        {trips?.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Noch keine Reise. Lege unten deine erste an oder öffne einen Einladungslink.
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips?.map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/trips/${trip.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-600 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{trip.title}</h2>
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800 dark:bg-brand-800/40 dark:text-brand-100">
                    {roleLabels[trip.trip_members[0]?.role ?? 'buddy']}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{formatDateRange(trip.start_date, trip.end_date)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Neue Reise</h2>
        <form onSubmit={createTrip} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="trip-title" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="trip-title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Portugal 2027"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Zeitraum</span>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !title.trim()}>
              Reise anlegen
            </Button>
          </div>
        </form>
      </section>

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
