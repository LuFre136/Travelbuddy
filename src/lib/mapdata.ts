import { localDayKey } from './datetime'
import { transferModeLabels, transferTitle, type ActivityStatus, type Place, type TripPlan } from './plan'

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
}

export interface MapLine {
  id: string
  title: string
  coordinates: [number, number][]
  day: string | null
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

export function buildMapData(plan: TripPlan, filter: MapFilter): MapData {
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
      })
    }
  }

  if (filter.kinds.has('waypoint')) {
    for (const transfer of plan.transfers) {
      const day = transfer.depart_at ? localDayKey(transfer.depart_at) : null
      if (!visibleOnDay(filter.day, day, day)) continue
      const title = transferTitle(transfer)
      const positioned = transfer.waypoints.filter((w) => hasPosition(w.place))
      for (const w of transfer.waypoints) {
        if (!hasPosition(w.place)) {
          unplaced.push({ id: `waypoint-${w.id}`, title: w.place.name })
          continue
        }
        points.push({
          id: `waypoint-${w.id}`,
          kind: 'waypoint',
          title: w.place.name,
          subtitle: `${transferModeLabels[transfer.mode]}: ${title}`,
          lat: w.place.lat!,
          lng: w.place.lng!,
          status: null,
          dayFrom: day,
          dayTo: day,
        })
      }
      if (positioned.length >= 2) {
        lines.push({
          id: `transfer-${transfer.id}`,
          title,
          coordinates: positioned.map((w) => [w.place.lng!, w.place.lat!]),
          day,
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
        properties: { id: p.id, kind: p.kind, title: p.title, subtitle: p.subtitle ?? '', status: p.status ?? '' },
      })),
    },
    lines: {
      type: 'FeatureCollection' as const,
      features: data.lines.map((l) => ({
        type: 'Feature' as const,
        id: l.id,
        geometry: { type: 'LineString' as const, coordinates: l.coordinates },
        properties: { id: l.id, title: l.title },
      })),
    },
  }
}
