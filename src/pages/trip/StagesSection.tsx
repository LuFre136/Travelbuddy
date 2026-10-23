import { useState, type FormEvent } from 'react'
import { DateRangePicker, type DayRange } from '../../components/DateRangePicker'
import { Button, Card, ErrorText, Field, Input, SecondaryButton, TextButton } from '../../components/ui'
import { formatDateRange } from '../../lib/format'
import { deleteRow, saveStage, type Stage } from '../../lib/plan'
import { nextStageColor, stageColors, stageDayLabel } from '../../lib/stages'
import { DeleteButton, type TabProps } from './shared'

/** Etappen der Reise: Liste und (für Host/Travelguide) Bearbeiten. */
export function StagesSection({ trip, plan, canEdit, reload }: TabProps) {
  const [editing, setEditing] = useState<Stage | 'new' | null>(null)
  const done = async (saved: boolean) => {
    setEditing(null)
    if (saved) await reload()
  }

  if (plan.stages.length === 0 && !canEdit) return null

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Etappen</h3>
        {canEdit && editing === null && <TextButton onClick={() => setEditing('new')}>+ Etappe hinzufügen</TextButton>}
      </div>
      {plan.stages.length === 0 && editing === null && (
        <p className="text-sm text-slate-500">
          Teile die Reise in Etappen, z. B. Tag 1–3 Palma, Tag 4–6 Alcudia. Einträge bekommen dann die Farbe ihrer
          Etappe, auch auf der Karte.
        </p>
      )}
      {editing === 'new' && (
        <StageForm tripId={trip.id} tripStart={trip.start_date} color={nextStageColor(plan.stages)} onDone={done} />
      )}
      <ul className="flex flex-wrap gap-2">
        {plan.stages.map((stage) =>
          editing !== 'new' && editing?.id === stage.id ? (
            <li key={stage.id} className="w-full">
              <StageForm tripId={trip.id} tripStart={trip.start_date} stage={stage} onDone={done} />
            </li>
          ) : (
            <li key={stage.id}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditing(stage)}
                className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-white disabled:cursor-default"
                style={{ background: stage.color }}
                title={canEdit ? 'Etappe bearbeiten' : undefined}
              >
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">
                  {stageDayLabel(trip.start_date, stage) ?? formatDateRange(stage.start_day, stage.end_day)}
                </span>
                <span className="font-medium">{stage.name}</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

function StageForm({
  tripId,
  tripStart,
  stage,
  color: initialColor,
  onDone,
}: {
  tripId: string
  tripStart: string | null
  stage?: Stage
  color?: string
  onDone: (saved: boolean) => Promise<void>
}) {
  const [name, setName] = useState(stage?.name ?? '')
  const [color, setColor] = useState(stage?.color ?? initialColor ?? stageColors[0])
  const [range, setRange] = useState<DayRange>({ start: stage?.start_day ?? null, end: stage?.end_day ?? null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = stage?.id ?? 'new'
  const dayLabel = range.start ? stageDayLabel(tripStart, { start_day: range.start, end_day: range.end }) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveStage(tripId, stage?.id ?? null, {
        name: name.trim(),
        color,
        start_day: range.start,
        end_day: range.end ?? range.start,
      })
      await onDone(true)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h4 className="font-semibold">{stage ? 'Etappe bearbeiten' : 'Neue Etappe'}</h4>
        <Field label="Name" htmlFor={`${prefix}-stage-name`}>
          <Input
            id={`${prefix}-stage-name`}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Palma"
          />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Farbe</legend>
          <div className="flex flex-wrap gap-2">
            {stageColors.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`size-8 rounded-full ${c === color ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <div className="space-y-1">
          <span className="text-sm font-medium">
            Tage{dayLabel && <span className="font-normal text-slate-500"> · {dayLabel}</span>}
          </span>
          <DateRangePicker value={range} onChange={setRange} defaultMonth={tripStart} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            Speichern
          </Button>
          <SecondaryButton type="button" onClick={() => onDone(false)}>
            Abbrechen
          </SecondaryButton>
          {stage && (
            <DeleteButton
              onDelete={async () => {
                await deleteRow('stages', stage.id)
                await onDone(true)
              }}
            />
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  )
}
