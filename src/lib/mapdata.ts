import { localDayKey } from './datetime'
import { stageOf, tripDayNumber } from './stages'
import {
  transferModeLabels,
  transferTitle,
  type ActivityStatus,
  type Place,
  type TransferMode,
  type TripPlan,
} from './plan'

export type MapKind = 'stay' | 'activity' | 'waypoint'

export interface MapPoint {
  id: string
  kind: MapKind
  title: string
  subtitle: string | null
  lat: number
  lng: number
  status: ActivityStatus | null
  /** Erster und letzter Tag, an dem der Eintrag relevant ist (null = ohne Datum). */
  dayFrom: string | null
  dayTo: string | null
  /** Farbe der Etappe; null = Farbe nach Art. */
  color: string | null
  /** Reisetag (1 = Anreisetag), wird im Pin angezeigt. */
  dayNumber: number | null
}

/** Ein Abschnitt zwischen zwei Wegpunkten eines Transfers. */
export interface MapLine {
  id: string
  title: string
  mode: TransferMode
  color: string | null
  coordinates: [number, number][]
}

export interface MapFilter {
  day: string | 'all'
  kinds: ReadonlySet<MapKind>
}

export interface MapData {
  points: MapPoint[]
  lines: MapLine[]
  /** Einträge mit Ort, aber ohne Kartenposition. */
  unplaced: { id: string; title: string }[]
  bounds: [number, number, number, number] | null
}

function hasPosition(place: Place | null): place is Place & { lat: number; lng: number } {
  return place !== null && place.lat !== null && place.lng !== null
}

function visibleOnDay(day: string | 'all', from: string | null, to: string | null): boolean {
  if (day === 'all') return true
  if (!from) return false
  return from <= day && day <= (to ?? from)
}

export function buildMapData(plan: TripPlan, filter: MapFilter, tripStart: string | null = null): MapData {
  const points: MapPoint[] = []
  const lines: MapLine[] = []
  const unplaced: MapData['unplaced'] = []

  if (filter.kinds.has('stay')) {
    for (const stay of plan.stays) {
      const from = stay.check_in ? localDayKey(stay.check_in) : null
      const to = stay.check_out ? localDayKey(stay.check_out) : from
      if (!visibleOnDay(filter.day, from, to)) continue
      if (!stay.place) continue
      if (!hasPosition(stay.place)) {
        unplaced.push({ id: `stay-${stay.id}`, title: stay.title })
        continue
      }
      points.push({
        id: `stay-${stay.id}`,
        kind: 'stay',
        title: stay.title,
        subtitle: stay.place.address,
        lat: stay.place.lat,
        lng: stay.place.lng,
        status: null,
        dayFrom: from,
        dayTo: to,
        color: stageOf(plan.stages, stay, from)?.color ?? null,
        dayNumber: tripDayNumber(tripStart, from),
      })
    }
  }

  if (filter.kinds.has('activity')) {
    for (const activity of plan.activities) {
      if (!visibleOnDay(filter.day, activity.date, activity.date)) continue
      if (!activity.place) continue
      if (!hasPosition(activity.place)) {
        unplaced.push({ id: `activity-${activity.id}`, title: activity.title })
        continue
      }
      points.push({
        id: `activity-${activity.id}`,
        kind: 'activity',
        title: activity.title,
        subtitle: activity.place.name !== activity.title ? activity.place.name : activity.place.address,
        lat: activity.place.lat,
        lng: activity.place.lng,
        status: activity.status,
        dayFrom: activity.date,
        dayTo: activity.date,
        color: stageOf(plan.stages, activity, activity.date)?.color ?? null,
        dayNumber: tripDayNumber(tripStart, activity.date),
      })
    }
  }

  if (filter.kinds.has('waypoint')) {
    for (const transfer of plan.transfers) {
      const departDay = transfer.depart_at ? localDayKey(transfer.depart_at) : null
      const title = transferTitle(transfer)
      const color = stageOf(plan.stages, transfer, departDay)?.color ?? null
      // Ohne eigenes Datum gilt für einen Wegpunkt der Tag der Abfahrt.
      const stops = transfer.waypoints.map((w) => ({ w, day: w.day ?? departDay }))
      stops.forEach(({ w, day }, i) => {
        if (!visibleOnDay(filter.day, day, day)) return
        if (!hasPosition(w.place)) {
          unplaced.push({ id: `waypoint-${w.id}`, title: w.place.name })
          return
        }
        const mode = i === 0 ? transfer.mode : (w.segment_mode ?? transfer.mode)
        points.push({
          id: `waypoint-${w.id}`,
          kind: 'waypoint',
          title: w.place.name,
          subtitle: `${transferModeLabels[mode]}: ${title}`,
          lat: w.place.lat,
          lng: w.place.lng,
          status: null,
          dayFrom: day,
          dayTo: day,
          color,
          dayNumber: tripDayNumber(tripStart, day),
        })
      })
      for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1]
        const to = stops[i]
        if (!hasPosition(from.w.place) || !hasPosition(to.w.place)) continue
        if (!visibleOnDay(filter.day, from.day, from.day) && !visibleOnDay(filter.day, to.day, to.day)) continue
        const mode = to.w.segment_mode ?? transfer.mode
        lines.push({
          id: `segment-${to.w.id}`,
          title: `${transferModeLabels[mode]}: ${from.w.place.name} → ${to.w.place.name}`,
          mode,
          color,
          coordinates: [
            [from.w.place.lng, from.w.place.lat],
            [to.w.place.lng, to.w.place.lat],
          ],
        })
      }
    }
  }

  const coords = [...points.map((p) => [p.lng, p.lat] as const), ...lines.flatMap((l) => l.coordinates)]
  const bounds: MapData['bounds'] =
    coords.length === 0
      ? null
      : [
          Math.min(...coords.map((c) => c[0])),
          Math.min(...coords.map((c) => c[1])),
          Math.max(...coords.map((c) => c[0])),
          Math.max(...coords.map((c) => c[1])),
        ]

  return { points, lines, unplaced, bounds }
}

export function toGeoJson(data: MapData) {
  return {
    points: {
      type: 'FeatureCollection' as const,
      features: data.points.map((p) => ({
        type: 'Feature' as const,
        id: p.id,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          kind: p.kind,
          title: p.title,
          subtitle: p.subtitle ?? '',
          status: p.status ?? '',
          label: p.dayNumber !== null ? String(p.dayNumber) : '',
          ...(p.color ? { color: p.color } : {}),
        },
      })),
    },
    lines: {
      type: 'FeatureCollection' as const,
      features: data.lines.map((l) => ({
        type: 'Feature' as const,
        id: l.id,
        geometry: { type: 'LineString' as const, coordinates: l.coordinates },
        properties: { id: l.id, title: l.title, mode: l.mode, ...(l.color ? { color: l.color } : {}) },
      })),
    },
  }
}
