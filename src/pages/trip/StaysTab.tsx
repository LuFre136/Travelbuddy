import { useState, type FormEvent } from 'react'
import { PlacePicker } from '../../components/PlacePicker'
import { Button, Card, ErrorText, Field, Input, SecondaryButton, Textarea, TextButton } from '../../components/ui'
import { StageField } from '../../components/StageField'
import { addDays, fromDateTimeInput, localDayKey, toDateTimeInput } from '../../lib/datetime'

import type { PlaceInput } from '../../lib/places'
import { deleteRow, saveStay, type Place, type Stage, type Stay } from '../../lib/plan'
import { emptyToNull, formatCost, formatDateTime, parseCost } from '../../lib/format'
import { DeleteButton, EmptyState, StageBadge, type TabProps } from './shared'
import { stageOf } from '../../lib/stages'

export function StaysTab({ trip, plan, canEdit, reload }: TabProps) {
  const [editing, setEditing] = useState<Stay | 'new' | null>(null)

  return (
    <div className="space-y-4">
      {canEdit && editing === null && <Button onClick={() => setEditing('new')}>Unterkunft hinzufügen</Button>}
      {editing === 'new' && (
        <StayForm
          tripId={trip.id}
          defaultDate={trip.start_date}
          stages={plan.stages}
          onDone={async (saved) => {
            setEditing(null)
            if (saved) await reload()
          }}
        />
      )}
      {plan.stays.length === 0 && editing === null && <EmptyState>Noch keine Unterkunft eingetragen.</EmptyState>}
      <ul className="space-y-3">
        {plan.stays.map((stay) =>
          editing !== 'new' && editing?.id === stay.id ? (
            <li key={stay.id}>
              <StayForm
                tripId={trip.id}
                stages={plan.stages}
                stay={stay}
                defaultDate={trip.start_date}
                onDone={async (saved) => {
                  setEditing(null)
                  if (saved) await reload()
                }}
              />
            </li>
          ) : (
            <li key={stay.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{stay.title}</h3>
                    <StageBadge stage={stageOf(plan.stages, stay, stay.check_in ? localDayKey(stay.check_in) : null)} />
                    {stay.place && <p className="text-sm text-slate-500">{stay.place.address ?? stay.place.name}</p>}
                  </div>
                  {formatCost(stay.cost, stay.currency) && (
                    <span className="text-sm tabular-nums">{formatCost(stay.cost, stay.currency)}</span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Check-in</dt>
                    <dd>{formatDateTime(stay.check_in) ?? 'offen'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Check-out</dt>
                    <dd>{formatDateTime(stay.check_out) ?? 'offen'}</dd>
                  </div>
                </dl>
                {stay.booking_ref && (
                  <p className="text-sm">
                    Buchungsnummer: <span className="font-mono">{stay.booking_ref}</span>
                  </p>
                )}
                {stay.notes && (
                  <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{stay.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  {stay.link && (
                    <a
                      href={stay.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-700 hover:underline dark:text-brand-100"
                    >
                      Buchung öffnen
                    </a>
                  )}
                  {canEdit && (
                    <>
                      <TextButton onClick={() => setEditing(stay)}>Bearbeiten</TextButton>
                      <DeleteButton
                        onDelete={async () => {
                          await deleteRow('stays', stay.id)
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

function StayForm({
  tripId,
  stay,
  defaultDate,
  stages,
  onDone,
}: {
  tripId: string
  stay?: Stay
  defaultDate: string | null
  stages: Stage[]
  onDone: (saved: boolean) => Promise<void>
}) {
  const [title, setTitle] = useState(stay?.title ?? '')
  const [place, setPlace] = useState<PlaceInput | Place | null>(stay?.place ?? null)
  const [checkIn, setCheckIn] = useState(
    stay ? toDateTimeInput(stay.check_in) : defaultDate ? `${defaultDate}T15:00` : '',
  )
  const [checkOut, setCheckOut] = useState(toDateTimeInput(stay?.check_out ?? null))
  const [stageId, setStageId] = useState(stay?.stage_id ?? null)

  function chooseStage(id: string | null) {
    setStageId(id)
    const stage = stages.find((s) => s.id === id)
    // Neue Etappe ohne Daten: Unterkunft über die ganze Etappe vorschlagen.
    if (stage?.start_day && !checkIn) {
      setCheckIn(`${stage.start_day}T15:00`)
      if (!checkOut) setCheckOut(`${addDays(stage.end_day ?? stage.start_day, 1)}T10:00`)
    }
  }
  const [bookingRef, setBookingRef] = useState(stay?.booking_ref ?? '')
  const [link, setLink] = useState(stay?.link ?? '')
  const [cost, setCost] = useState(stay?.cost?.toString() ?? '')
  const [currency, setCurrency] = useState(stay?.currency ?? 'EUR')
  const [notes, setNotes] = useState(stay?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = stay?.id ?? 'new'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (checkIn && checkOut && checkOut < checkIn) {
      setError('Der Check-out liegt vor dem Check-in.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveStay(
        tripId,
        stay?.id ?? null,
        {
          stage_id: stageId,
          title: title.trim() || place?.name || 'Unterkunft',
          check_in: fromDateTimeInput(checkIn),
          check_out: fromDateTimeInput(checkOut),
          booking_ref: emptyToNull(bookingRef),
          link: emptyToNull(link),
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
        <h3 className="font-semibold sm:col-span-2">{stay ? 'Unterkunft bearbeiten' : 'Neue Unterkunft'}</h3>
        <div className="sm:col-span-2">
          <Field label="Ort" htmlFor={`${prefix}-stay-place`}>
            <PlacePicker
              id={`${prefix}-stay-place`}
              value={place}
              onChange={setPlace}
              placeholder="Hotel, Adresse oder Stadt"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Name" htmlFor={`${prefix}-stay-title`}>
            <Input
              id={`${prefix}-stay-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={place?.name ?? 'z. B. Hostel Alfama'}
            />
          </Field>
        </div>
        {stages.length > 0 && (
          <div className="sm:col-span-2">
            <StageField
              id={`${prefix}-stay-stage`}
              stages={stages}
              tripStart={defaultDate}
              stageId={stageId}
              day={checkIn ? checkIn.slice(0, 10) : null}
              onStage={chooseStage}
              onDay={(day) => setCheckIn(`${day}T${checkIn.slice(11) || '15:00'}`)}
            />
          </div>
        )}
        <Field label="Check-in" htmlFor={`${prefix}-stay-in`}>
          <Input
            id={`${prefix}-stay-in`}
            type="datetime-local"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field label="Check-out" htmlFor={`${prefix}-stay-out`}>
          <Input
            id={`${prefix}-stay-out`}
            type="datetime-local"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
        <Field label="Buchungsnummer" htmlFor={`${prefix}-stay-ref`}>
          <Input id={`${prefix}-stay-ref`} value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
        </Field>
        <Field label="Link zur Buchung" htmlFor={`${prefix}-stay-link`}>
          <Input
            id={`${prefix}-stay-link`}
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Kosten" htmlFor={`${prefix}-stay-cost`}>
          <Input
            id={`${prefix}-stay-cost`}
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Währung" htmlFor={`${prefix}-stay-currency`}>
          <Input
            id={`${prefix}-stay-currency`}
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notizen" htmlFor={`${prefix}-stay-notes`}>
            <Textarea id={`${prefix}-stay-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
