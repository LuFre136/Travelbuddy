import { formatDay } from '../../lib/datetime'
import { transferModeLabels, transferTitle } from '../../lib/plan'
import { stageDayLabel, stageForDay } from '../../lib/stages'
import { buildTimeline, type TimelineEntry } from '../../lib/timeline'
import { ActivityStatusPill } from './ActivitiesTab'
import { EmptyState, type TabProps } from './shared'
import { StagesSection } from './StagesSection'

const kindLabels: Record<TimelineEntry['kind'], string> = {
  checkin: 'Check-in',
  checkout: 'Check-out',
  transfer: 'Transfer',
  activity: 'Aktivität',
}

function EntryRow({ entry }: { entry: TimelineEntry }) {
  let title: string
  let detail: string | null = null
  switch (entry.kind) {
    case 'checkin':
    case 'checkout':
      title = entry.stay.title
      detail = entry.stay.place?.address ?? null
      break
    case 'transfer':
      title = transferTitle(entry.transfer)
      detail = [
        transferModeLabels[entry.mode],
        entry.transfer.waypoints.length === 3 && '1 Zwischenstopp',
        entry.transfer.waypoints.length > 3 && `${entry.transfer.waypoints.length - 2} Zwischenstopps`,
      ]
        .filter(Boolean)
        .join(' · ')
      break
    case 'activity':
      title = entry.activity.title
      detail =
        entry.activity.place && entry.activity.place.name !== entry.activity.title ? entry.activity.place.name : null
      break
  }

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-2">
      <span className="pt-0.5 text-sm text-slate-500 tabular-nums">{entry.time ?? '–'}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tracking-wide text-slate-500 uppercase">{kindLabels[entry.kind]}</span>
          {entry.kind === 'activity' && <ActivityStatusPill status={entry.status} />}
        </div>
        <p
          className={
            entry.kind === 'activity' && entry.status === 'optional'
              ? 'text-slate-600 dark:text-slate-300'
              : 'font-medium'
          }
        >
          {title}
        </p>
        {detail && <p className="text-sm text-slate-500">{detail}</p>}
      </div>
    </li>
  )
}

export function PlanTab(props: TabProps) {
  const { trip, plan } = props
  const timeline = buildTimeline(trip, plan)
  const stageOfDay = timeline.days.map((day) => stageForDay(plan.stages, day.key))

  return (
    <div className="space-y-6">
      <StagesSection {...props} />
      {timeline.days.length === 0 && timeline.undated.length === 0 && (
        <EmptyState>
          Noch nichts geplant. Trage Unterkünfte, Transfers oder Aktivitäten ein, dann erscheinen sie hier Tag für Tag.
        </EmptyState>
      )}
      {timeline.days.map((day, index) => {
        const stage = stageOfDay[index]
        const stageStarts = stage && stage.id !== stageOfDay[index - 1]?.id
        return (
          <section
            key={day.key}
            className={`space-y-1 ${stage ? 'border-l-4 pl-3' : ''}`}
            style={stage ? { borderColor: stage.color } : undefined}
          >
            {stageStarts && (
              <p
                className="inline-flex items-center gap-2 rounded-full px-3 py-0.5 text-sm font-medium text-white"
                style={{ background: stage.color }}
              >
                {stage.name}
                <span className="text-xs font-normal opacity-90">{stageDayLabel(trip.start_date, stage)}</span>
              </p>
            )}
            <h3 className="flex flex-wrap items-baseline gap-x-3 font-semibold">
              <span>Tag {index + 1}</span>
              <span className="text-sm font-normal text-slate-500">{formatDay(day.key)}</span>
            </h3>
            {day.entries.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {day.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-slate-500">Nichts geplant.</p>
            )}
            {day.night && <p className="text-sm text-slate-500">Übernachtung: {day.night.title}</p>}
          </section>
        )
      })}
      {timeline.undated.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-semibold">Noch ohne Datum</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {timeline.undated.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
