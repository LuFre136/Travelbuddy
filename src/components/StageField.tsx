import { formatDay } from '../lib/datetime'
import type { Stage } from '../lib/plan'
import { stageDayLabel, stageDays, tripDayNumber } from '../lib/stages'
import { Select } from './ui'

/**
 * Etappe wählen und darunter per Klick einen Tag der Etappe (z. B. „Palma · Tag 2“).
 * Der Tag setzt das Datum des Eintrags.
 */
export function StageField({
  id,
  stages,
  tripStart,
  stageId,
  day,
  onStage,
  onDay,
}: {
  id: string
  stages: Stage[]
  tripStart: string | null
  stageId: string | null
  day: string | null
  onStage: (stageId: string | null) => void
  onDay: (day: string) => void
}) {
  if (stages.length === 0) return null
  const stage = stages.find((s) => s.id === stageId) ?? null
  const days = stage ? stageDays(stage) : []

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Etappe
      </label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
          style={{ background: stage?.color ?? 'transparent' }}
        />
        <Select id={id} value={stageId ?? ''} onChange={(e) => onStage(e.target.value || null)}>
          <option value="">Keine Etappe</option>
          {stages.map((s) => {
            const label = stageDayLabel(tripStart, s)
            return (
              <option key={s.id} value={s.id}>
                {label ? `${s.name} (${label})` : s.name}
              </option>
            )
          })}
        </Select>
      </div>
      {days.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tag der Etappe">
          {days.map((d) => {
            const n = tripDayNumber(tripStart, d)
            const active = d === day
            return (
              <button
                key={d}
                type="button"
                title={formatDay(d)}
                aria-pressed={active}
                onClick={() => onDay(d)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'
                }`}
                style={active ? { background: stage!.color } : undefined}
              >
                {n !== null ? `Tag ${n}` : formatDay(d)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
