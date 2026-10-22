import { useState, type FormEvent } from 'react'
import { PlacePicker } from '../../components/PlacePicker'
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  SecondaryButton,
  Select,
  Textarea,
  TextButton,
} from '../../components/ui'
import { formatTime, fromDateTimeInput, toDateTimeInput } from '../../lib/datetime'

import {
  deleteRow,
  saveTransfer,
  transferModeLabels,
  transferTitle,
  type Transfer,
  type TransferMode,
  type WaypointDraft,
} from '../../lib/plan'
import { emptyToNull, formatDateTime } from '../../lib/format'
import { DeleteButton, EmptyState, type TabProps } from './shared'

export function TransfersTab({ trip, plan, canEdit, reload }: TabProps) {
  const [editing, setEditing] = useState<Transfer | 'new' | null>(null)
  const done = async (saved: boolean) => {
    setEditing(null)
    if (saved) await reload()
  }

  return (
    <div className="space-y-4">
      {canEdit && editing === null && <Button onClick={() => setEditing('new')}>Transfer hinzufügen</Button>}
      {editing === 'new' && <TransferForm tripId={trip.id} defaultDate={trip.start_date} onDone={done} />}
      {plan.transfers.length === 0 && editing === null && <EmptyState>Noch keine Transfers eingetragen.</EmptyState>}
      <ul className="space-y-3">
        {plan.transfers.map((transfer) =>
          editing !== 'new' && editing?.id === transfer.id ? (
            <li key={transfer.id}>
              <TransferForm tripId={trip.id} transfer={transfer} defaultDate={trip.start_date} onDone={done} />
            </li>
          ) : (
            <li key={transfer.id}>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{transferTitle(transfer)}</h3>
                    <p className="text-sm text-slate-500">
                      {[
                        transferModeLabels[transfer.mode],
                        formatDateTime(transfer.depart_at),
                        transfer.arrive_at && `an ${formatTime(transfer.arrive_at)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                {transfer.waypoints.length > 0 && (
                  <ol className="space-y-1 border-l-2 border-brand-600 pl-4 text-sm">
                    {transfer.waypoints.map((w) => (
                      <li key={w.id} className="relative">
                        <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-brand-600 bg-white dark:bg-slate-900" />
                        <span className="font-medium">{w.place.name}</span>
                        {w.planned_time && <span className="text-slate-500"> · {formatTime(w.planned_time)}</span>}
                        {w.stop_note && <span className="block text-xs text-slate-500">{w.stop_note}</span>}
                      </li>
                    ))}
                  </ol>
                )}
                {transfer.booking_ref && (
                  <p className="text-sm">
                    Buchungsnummer: <span className="font-mono">{transfer.booking_ref}</span>
                  </p>
                )}
                {transfer.notes && (
                  <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{transfer.notes}</p>
                )}
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-4">
                    <TextButton onClick={() => setEditing(transfer)}>Bearbeiten</TextButton>
                    <DeleteButton
                      onDelete={async () => {
                        await deleteRow('transfers', transfer.id)
                        await reload()
                      }}
                    />
                  </div>
                )}
              </Card>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

interface WaypointRow extends WaypointDraft {
  key: string
}

function TransferForm({
  tripId,
  transfer,
  defaultDate,
  onDone,
}: {
  tripId: string
  transfer?: Transfer
  defaultDate: string | null
  onDone: (saved: boolean) => Promise<void>
}) {
  const [title, setTitle] = useState(transfer?.title ?? '')
  const [mode, setMode] = useState<TransferMode>(transfer?.mode ?? 'train')
  const [departAt, setDepartAt] = useState(
    transfer ? toDateTimeInput(transfer.depart_at) : defaultDate ? `${defaultDate}T09:00` : '',
  )
  const [arriveAt, setArriveAt] = useState(toDateTimeInput(transfer?.arrive_at ?? null))
  const [bookingRef, setBookingRef] = useState(transfer?.booking_ref ?? '')
  const [notes, setNotes] = useState(transfer?.notes ?? '')
  const [waypoints, setWaypoints] = useState<WaypointRow[]>(
    transfer?.waypoints.map((w) => ({
      key: w.id,
      place: w.place,
      planned_time: w.planned_time,
      stop_note: w.stop_note,
    })) ?? [],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = transfer?.id ?? 'new'

  function move(index: number, delta: -1 | 1) {
    setWaypoints((rows) => {
      const next = [...rows]
      const [row] = next.splice(index, 1)
      next.splice(index + delta, 0, row)
      return next
    })
  }

  function updateRow(index: number, patch: Partial<WaypointRow>) {
    setWaypoints((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (departAt && arriveAt && arriveAt < departAt) {
      setError('Die Ankunft liegt vor der Abfahrt.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveTransfer(
        tripId,
        transfer?.id ?? null,
        {
          title: emptyToNull(title),
          mode,
          depart_at: fromDateTimeInput(departAt),
          arrive_at: fromDateTimeInput(arriveAt),
          booking_ref: emptyToNull(bookingRef),
          notes: emptyToNull(notes),
        },
        waypoints,
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
        <h3 className="font-semibold sm:col-span-2">{transfer ? 'Transfer bearbeiten' : 'Neuer Transfer'}</h3>
        <Field label="Verkehrsmittel" htmlFor={`${prefix}-tr-mode`}>
          <Select id={`${prefix}-tr-mode`} value={mode} onChange={(e) => setMode(e.target.value as TransferMode)}>
            {Object.entries(transferModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bezeichnung (optional)" htmlFor={`${prefix}-tr-title`}>
          <Input
            id={`${prefix}-tr-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. IC 523"
          />
        </Field>
        <Field label="Abfahrt" htmlFor={`${prefix}-tr-depart`}>
          <Input
            id={`${prefix}-tr-depart`}
            type="datetime-local"
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
          />
        </Field>
        <Field label="Ankunft" htmlFor={`${prefix}-tr-arrive`}>
          <Input
            id={`${prefix}-tr-arrive`}
            type="datetime-local"
            value={arriveAt}
            min={departAt || undefined}
            onChange={(e) => setArriveAt(e.target.value)}
          />
        </Field>

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Wegpunkte (Start, Zwischenstopps, Ziel)</legend>
          {waypoints.length === 0 && <p className="text-sm text-slate-500">Noch keine Wegpunkte.</p>}
          <ol className="space-y-2">
            {waypoints.map((row, index) => (
              <li key={row.key} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500">
                      {index === 0 ? 'Start' : index === waypoints.length - 1 ? 'Ziel' : `Stopp ${index}`}
                    </span>
                    <p className="font-medium">{row.place.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <TextButton aria-label="Nach oben" disabled={index === 0} onClick={() => move(index, -1)}>
                      ↑
                    </TextButton>
                    <TextButton
                      aria-label="Nach unten"
                      disabled={index === waypoints.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </TextButton>
                    <TextButton
                      className="text-red-700 dark:text-red-400"
                      onClick={() => setWaypoints((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Entfernen
                    </TextButton>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    id={`${prefix}-wp-${row.key}-time`}
                    type="datetime-local"
                    aria-label="Geplante Zeit"
                    value={toDateTimeInput(row.planned_time)}
                    onChange={(e) => updateRow(index, { planned_time: fromDateTimeInput(e.target.value) })}
                  />
                  <Input
                    id={`${prefix}-wp-${row.key}-note`}
                    aria-label="Notiz zum Stopp"
                    placeholder="Notiz, z. B. Gleis 4"
                    value={row.stop_note ?? ''}
                    onChange={(e) => updateRow(index, { stop_note: e.target.value || null })}
                  />
                </div>
              </li>
            ))}
          </ol>
          <PlacePicker
            id={`${prefix}-wp-add`}
            value={null}
            onChange={(place) => {
              if (place)
                setWaypoints((rows) => [
                  ...rows,
                  { key: crypto.randomUUID(), place, planned_time: null, stop_note: null },
                ])
            }}
            placeholder="Wegpunkt hinzufügen: Bahnhof, Flughafen, Stadt …"
          />
        </fieldset>

        <Field label="Buchungsnummer" htmlFor={`${prefix}-tr-ref`}>
          <Input id={`${prefix}-tr-ref`} value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notizen" htmlFor={`${prefix}-tr-notes`}>
            <Textarea id={`${prefix}-tr-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy}>
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
