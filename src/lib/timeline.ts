import { addDays, formatTime, localDayKey } from './datetime'
import type { Activity, ActivityStatus, Stay, Transfer, TransferMode, TripPlan } from './plan'

export type TimelineEntry =
  | { kind: 'checkin' | 'checkout'; id: string; time: string | null; stay: Stay }
  | { kind: 'transfer'; id: string; time: string | null; transfer: Transfer; mode: TransferMode }
  | { kind: 'activity'; id: string; time: string | null; activity: Activity; status: ActivityStatus }

export interface TimelineDay {
  key: string
  /** Unterkunft, in der man in der Nacht nach diesem Tag schläft. */
  night: Stay | null
  entries: TimelineEntry[]
}

export interface Timeline {
  days: TimelineDay[]
  undated: TimelineEntry[]
}

const kindOrder: Record<TimelineEntry['kind'], number> = { checkout: 0, transfer: 1, activity: 2, checkin: 3 }

function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  // Einträge mit Uhrzeit chronologisch, ohne Uhrzeit nach Art (Check-out zuerst, Check-in zuletzt).
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1
  if (a.time && !b.time) return -1
  if (!a.time && b.time) return 1
  return kindOrder[a.kind] - kindOrder[b.kind]
}

export function buildTimeline(trip: { start_date: string | null; end_date: string | null }, plan: TripPlan): Timeline {
  const byDay = new Map<string, TimelineEntry[]>()
  const undated: TimelineEntry[] = []

  function add(day: string | null, entry: TimelineEntry) {
    if (!day) {
      undated.push(entry)
      return
    }
    const list = byDay.get(day) ?? []
    list.push(entry)
    byDay.set(day, list)
  }

  for (const stay of plan.stays) {
    if (!stay.check_in && !stay.check_out) {
      undated.push({ kind: 'checkin', id: `in-${stay.id}`, time: null, stay })
      continue
    }
    if (stay.check_in)
      add(localDayKey(stay.check_in), { kind: 'checkin', id: `in-${stay.id}`, time: formatTime(stay.check_in), stay })
    if (stay.check_out)
      add(localDayKey(stay.check_out), {
        kind: 'checkout',
        id: `out-${stay.id}`,
        time: formatTime(stay.check_out),
        stay,
      })
  }

  for (const transfer of plan.transfers) {
    add(transfer.depart_at ? localDayKey(transfer.depart_at) : null, {
      kind: 'transfer',
      id: `tr-${transfer.id}`,
      time: formatTime(transfer.depart_at),
      transfer,
      mode: transfer.mode,
    })
  }

  for (const activity of plan.activities) {
    add(activity.date, {
      kind: 'activity',
      id: `ac-${activity.id}`,
      time: formatTime(activity.start_time),
      activity,
      status: activity.status,
    })
  }

  const keys = new Set(byDay.keys())
  if (trip.start_date && trip.end_date && trip.end_date >= trip.start_date) {
    for (let day = trip.start_date; day <= trip.end_date; day = addDays(day, 1)) keys.add(day)
  }

  const nightStays = plan.stays.filter((s) => s.check_in && s.check_out)
  const days = [...keys].sort().map((key) => ({
    key,
    night: nightStays.find((s) => localDayKey(s.check_in!) <= key && key < localDayKey(s.check_out!)) ?? null,
    entries: (byDay.get(key) ?? []).sort(compareEntries),
  }))

  return { days, undated: undated.sort(compareEntries) }
}
