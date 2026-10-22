import { useState, type FormEvent } from 'react'
import { PlacePicker } from '../../components/PlacePicker'
import { Button, Card, ErrorText, Field, Input, SecondaryButton, Textarea, TextButton } from '../../components/ui'
import { formatDay, formatTime } from '../../lib/datetime'
import type { PlaceInput } from '../../lib/places'
import {
  activityStatusLabels,
  deleteRow,
  saveActivity,
  type Activity,
  type ActivityStatus,
  type Place,
} from '../../lib/plan'
import { emptyToNull, formatCost, parseCost } from '../../lib/format'
import { DeleteButton, EmptyState, type TabProps } from './shared'

export function ActivityStatusPill({ status }: { status: ActivityStatus }) {
  const style =
    status === 'planned'
      ? 'bg-brand-100 text-brand-800 dark:bg-brand-800/40 dark:text-brand-100'
      : 'border border-dashed border-slate-400 text-slate-600 dark:text-slate-300'
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${style}`}>{activityStatusLabels[status]}</span>
}

export function ActivitiesTab({ trip, plan, canEdit, reload }: TabProps) {
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [filter, setFilter] = useState<ActivityStatus | 'all'>('all')
  const activities = plan.activities.filter((a) => filter === 'all' || a.status === filter)

  const done = async (saved: boolean) => {
    setEditing(null)
    if (saved) await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canEdit && editing === null ? (
          <Button onClick={() => setEditing('new')}>Aktivität hinzufügen</Button>
        ) : (
          <span />
        )}
        <div
          role="group"
          aria-label="Filter"
          className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800"
        >
          {(['all', 'planned', 'optional'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 ${filter === f ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {f === 'all' ? 'Alle' : activityStatusLabels[f]}
            </button>
          ))}
        </div>
      </div>
      {editing === 'new' && <ActivityForm tripId={trip.id} onDone={done} />}
      {activities.length === 0 && editing === null && <EmptyState>Keine Aktivitäten in dieser Ansicht.</EmptyState>}
      <ul className="space-y-3">
        {activities.map((activity) =>
          editing !== 'new' && editing?.id === activity.id ? (
            <li key={activity.id}>
              <ActivityForm tripId={trip.id} activity={activity} onDone={done} />
            </li>
          ) : (
            <li key={activity.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{activity.title}</h3>
                    <p className="text-sm text-slate-500">
                      {[
                        activity.date ? formatDay(activity.date) : 'Ohne Datum',
                        [formatTime(activity.start_time), formatTime(activity.end_time)].filter(Boolean).join('–'),
                        activity.place?.name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <ActivityStatusPill status={activity.status} />
                </div>
                {activity.notes && (
                  <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{activity.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  {formatCost(activity.cost, activity.currency) && (
                    <span className="text-sm tabular-nums">{formatCost(activity.cost, activity.currency)}</span>
                  )}
                  {canEdit && (
                    <>
                      <TextButton onClick={() => setEditing(activity)}>Bearbeiten</TextButton>
                      <DeleteButton
                        onDelete={async () => {
                          await deleteRow('activities', activity.id)
                          await reload()
                        }}
                      />
                    </>
                  )}
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

function ActivityForm({
  tripId,
  activity,
  onDone,
}: {
  tripId: string
  activity?: Activity
  onDone: (saved: boolean) => Promise<void>
}) {
  const [title, setTitle] = useState(activity?.title ?? '')
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'optional')
  const [place, setPlace] = useState<PlaceInput | Place | null>(activity?.place ?? null)
  const [date, setDate] = useState(activity?.date ?? '')
  const [start, setStart] = useState(formatTime(activity?.start_time ?? null) ?? '')
  const [end, setEnd] = useState(formatTime(activity?.end_time ?? null) ?? '')
  const [cost, setCost] = useState(activity?.cost?.toString() ?? '')
  const [currency, setCurrency] = useState(activity?.currency ?? 'EUR')
  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = activity?.id ?? 'new'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveActivity(
        tripId,
        activity?.id ?? null,
        {
          title: title.trim() || place?.name || 'Aktivität',
          status,
          date: date || null,
          start_time: start || null,
          end_time: end || null,
          cost: parseCost(cost),
          currency: emptyToNull(currency)?.toUpperCase() ?? null,
          notes: emptyToNull(notes),
        },
        place,
      )
      await onDone(true)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">{activity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}</h3>
        <div className="sm:col-span-2">
          <Field label="Was?" htmlFor={`${prefix}-act-title`}>
            <Input
              id={`${prefix}-act-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Surfkurs in Ericeira"
            />
          </Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">Status</legend>
          <div className="flex gap-4 text-sm">
            {(['optional', 'planned'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${prefix}-act-status`}
                  id={`${prefix}-act-status-${s}`}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="accent-brand-600"
                />
                {activityStatusLabels[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Field label="Ort" htmlFor={`${prefix}-act-place`}>
            <PlacePicker id={`${prefix}-act-place`} value={place} onChange={setPlace} />
          </Field>
        </div>
        <Field label="Datum" htmlFor={`${prefix}-act-date`}>
          <Input id={`${prefix}-act-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von" htmlFor={`${prefix}-act-start`}>
            <Input id={`${prefix}-act-start`} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Bis" htmlFor={`${prefix}-act-end`}>
            <Input id={`${prefix}-act-end`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Kosten pro Person" htmlFor={`${prefix}-act-cost`}>
          <Input
            id={`${prefix}-act-cost`}
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Währung" htmlFor={`${prefix}-act-currency`}>
          <Input
            id={`${prefix}-act-currency`}
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notizen" htmlFor={`${prefix}-act-notes`}>
            <Textarea id={`${prefix}-act-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy || (!title.trim() && !place)}>
            Speichern
          </Button>
          <SecondaryButton type="button" onClick={() => onDone(false)}>
            Abbrechen
          </SecondaryButton>
        </div>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  )
}
