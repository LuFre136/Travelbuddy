import { addDays, localDayKey } from './datetime'
import type { Activity, Stage, Stay, Transfer } from './plan'

/** Farben für Etappen; gut unterscheidbar und mit weißer Schrift lesbar. */
export const stageColors = ['#0e6b58', '#c2410c', '#1d4ed8', '#9333ea', '#be185d', '#a16207', '#0f766e', '#475569']

export function nextStageColor(stages: Stage[]): string {
  return stageColors.find((c) => !stages.some((s) => s.color === c)) ?? stageColors[stages.length % stageColors.length]
}

/** Reisetag (1 = Anreisetag) eines Datums, oder null ohne Reisebeginn. */
export function tripDayNumber(tripStart: string | null, day: string | null): number | null {
  if (!tripStart || !day) return null
  const [y1, m1, d1] = tripStart.split('-').map(Number)
  const [y2, m2, d2] = day.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1
}

/** „Tag 1–3“, „Tag 4“ oder ohne Reisebeginn null. */
export function stageDayLabel(tripStart: string | null, stage: Pick<Stage, 'start_day' | 'end_day'>): string | null {
  const from = tripDayNumber(tripStart, stage.start_day)
  const to = tripDayNumber(tripStart, stage.end_day ?? stage.start_day)
  if (from === null || to === null) return null
  return from === to ? `Tag ${from}` : `Tag ${from}–${to}`
}

/** Alle Tage einer Etappe als "YYYY-MM-DD". */
export function stageDays(stage: Pick<Stage, 'start_day' | 'end_day'>): string[] {
  if (!stage.start_day) return []
  const end = stage.end_day ?? stage.start_day
  const days: string[] = []
  for (let day = stage.start_day; day <= end && days.length < 366; day = addDays(day, 1)) days.push(day)
  return days
}

/** Etappe, in die ein Tag fällt (die erste, falls sich Etappen überschneiden). */
export function stageForDay(stages: Stage[], day: string | null): Stage | null {
  if (!day) return null
  return stages.find((s) => s.start_day && s.start_day <= day && day <= (s.end_day ?? s.start_day)) ?? null
}

/** Etappe eines Eintrags: ausdrücklich zugeordnet, sonst nach Datum. */
export function stageOf(
  stages: Stage[],
  item: Pick<Stay | Transfer | Activity, 'stage_id'>,
  day: string | null,
): Stage | null {
  if (item.stage_id) return stages.find((s) => s.id === item.stage_id) ?? null
  return stageForDay(stages, day)
}

export function itemDay(item: Stay | Transfer | Activity): string | null {
  if ('check_in' in item) return item.check_in ? localDayKey(item.check_in) : null
  if ('depart_at' in item) return item.depart_at ? localDayKey(item.depart_at) : null
  return item.date
}
