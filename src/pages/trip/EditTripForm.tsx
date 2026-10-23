import { useState, type FormEvent } from 'react'
import { DateRangePicker, type DayRange } from '../../components/DateRangePicker'
import { Button, Card, ErrorText, Field, Input, SecondaryButton } from '../../components/ui'
import { requireSupabase } from '../../lib/supabase'
import type { Trip } from '../../lib/types'

export function EditTripForm({ trip, onDone }: { trip: Trip; onDone: (saved: boolean) => Promise<void> }) {
  const [title, setTitle] = useState(trip.title)
  const [range, setRange] = useState<DayRange>({ start: trip.start_date, end: trip.end_date })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await requireSupabase()
      .from('trips')
      .update({ title: title.trim(), start_date: range.start, end_date: range.end })
      .eq('id', trip.id)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    await onDone(true)
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">Reise bearbeiten</h2>
        <Field label="Name" htmlFor="edit-trip-title">
          <Input
            id="edit-trip-title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="space-y-1">
          <span className="text-sm font-medium">Zeitraum</span>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !title.trim()}>
            Speichern
          </Button>
          <SecondaryButton type="button" onClick={() => onDone(false)}>
            Abbrechen
          </SecondaryButton>
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  )
}
