import { requireSupabase } from './supabase'
import type { PlaceInput } from './places'

export type TransferMode = 'car' | 'train' | 'bus' | 'flight' | 'ferry' | 'walk' | 'bike' | 'other'
export type ActivityStatus = 'optional' | 'planned'

export const transferModeLabels: Record<TransferMode, string> = {
  car: 'Auto',
  train: 'Zug',
  bus: 'Bus',
  flight: 'Flug',
  ferry: 'Fähre',
  walk: 'Zu Fuß',
  bike: 'Fahrrad',
  other: 'Sonstiges',
}

export const activityStatusLabels: Record<ActivityStatus, string> = {
  optional: 'Optional',
  planned: 'Eingeplant',
}

export interface Place {
  id: string
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}

export interface Stay {
  id: string
  trip_id: string
  title: string
  check_in: string | null
  check_out: string | null
  booking_ref: string | null
  link: string | null
  cost: number | null
  currency: string | null
  notes: string | null
  place: Place | null
}

export interface Waypoint {
  id: string
  position: number
  day: string | null
  time: string | null
  /** Verkehrsmittel vom vorherigen Wegpunkt hierher; null = wie der Transfer. */
  segment_mode: TransferMode | null
  stop_note: string | null
  place: Place
}

export interface Transfer {
  id: string
  trip_id: string
  title: string | null
  mode: TransferMode
  depart_at: string | null
  arrive_at: string | null
  booking_ref: string | null
  notes: string | null
  waypoints: Waypoint[]
}

export interface Activity {
  id: string
  trip_id: string
  title: string
  status: ActivityStatus
  date: string | null
  start_time: string | null
  end_time: string | null
  cost: number | null
  currency: string | null
  notes: string | null
  place: Place | null
}

export interface TripPlan {
  stays: Stay[]
  transfers: Transfer[]
  activities: Activity[]
}

const placeColumns = 'id, name, lat, lng, address'

export async function loadPlan(tripId: string): Promise<TripPlan> {
  const db = requireSupabase()
  const [stays, transfers, activities] = await Promise.all([
    db
      .from('stays')
      .select(
        `id, trip_id, title, check_in, check_out, booking_ref, link, cost, currency, notes, place:places(${placeColumns})`,
      )
      .eq('trip_id', tripId)
      .order('check_in', { nullsFirst: false }),
    db
      .from('transfers')
      .select(
        `id, trip_id, title, mode, depart_at, arrive_at, booking_ref, notes,
         waypoints:transfer_waypoints(id, position, day, time, segment_mode, stop_note, place:places(${placeColumns}))`,
      )
      .eq('trip_id', tripId)
      .order('depart_at', { nullsFirst: false }),
    db
      .from('activities')
      .select(
        `id, trip_id, title, status, date, start_time, end_time, cost, currency, notes, place:places(${placeColumns})`,
      )
      .eq('trip_id', tripId)
      .order('date', { nullsFirst: false })
      .order('start_time', { nullsFirst: false }),
  ])
  const error = stays.error ?? transfers.error ?? activities.error
  if (error) throw new Error(error.message)

  const sortedTransfers = (transfers.data as unknown as Transfer[]).map((t) => ({
    ...t,
    waypoints: [...t.waypoints].sort((a, b) => a.position - b.position),
  }))
  return {
    stays: stays.data as unknown as Stay[],
    transfers: sortedTransfers,
    activities: activities.data as unknown as Activity[],
  }
}

/** Legt einen Ort an (oder nutzt einen bestehenden) und gibt seine ID zurück. */
export async function ensurePlace(tripId: string, place: PlaceInput | Place | null): Promise<string | null> {
  if (!place) return null
  if ('id' in place) return place.id
  const id = crypto.randomUUID()
  const { error } = await requireSupabase().from('places').insert({
    id,
    trip_id: tripId,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    category: place.category,
    source: place.source,
  })
  if (error) throw new Error(error.message)
  return id
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export interface StayDraft {
  title: string
  check_in: string | null
  check_out: string | null
  booking_ref: string | null
  link: string | null
  cost: number | null
  currency: string | null
  notes: string | null
}

export async function saveStay(tripId: string, id: string | null, draft: StayDraft, place: PlaceInput | Place | null) {
  const placeId = await ensurePlace(tripId, place)
  const row = { ...draft, place_id: placeId, trip_id: tripId }
  const db = requireSupabase()
  const { error } = id ? await db.from('stays').update(row).eq('id', id) : await db.from('stays').insert(row)
  throwIf(error)
}

export interface ActivityDraft {
  title: string
  status: ActivityStatus
  date: string | null
  start_time: string | null
  end_time: string | null
  cost: number | null
  currency: string | null
  notes: string | null
}

export async function saveActivity(
  tripId: string,
  id: string | null,
  draft: ActivityDraft,
  place: PlaceInput | Place | null,
) {
  const placeId = await ensurePlace(tripId, place)
  const row = { ...draft, place_id: placeId, trip_id: tripId }
  const db = requireSupabase()
  const { error } = id ? await db.from('activities').update(row).eq('id', id) : await db.from('activities').insert(row)
  throwIf(error)
}

export interface TransferDraft {
  title: string | null
  mode: TransferMode
  depart_at: string | null
  arrive_at: string | null
  booking_ref: string | null
  notes: string | null
}

export interface WaypointDraft {
  place: PlaceInput | Place
  day: string | null
  time: string | null
  segment_mode: TransferMode | null
  stop_note: string | null
}

export async function saveTransfer(
  tripId: string,
  id: string | null,
  draft: TransferDraft,
  waypoints: WaypointDraft[],
) {
  const placeIds: string[] = []
  for (const w of waypoints) placeIds.push((await ensurePlace(tripId, w.place))!)
  const { error } = await requireSupabase().rpc('save_transfer', {
    p_transfer: { ...draft, id: id ?? crypto.randomUUID(), trip_id: tripId },
    p_waypoints: waypoints.map((w, i) => ({
      place_id: placeIds[i],
      day: w.day,
      time: w.time || null,
      segment_mode: i === 0 ? null : w.segment_mode,
      stop_note: w.stop_note,
    })),
  })
  throwIf(error)
}

export async function deleteRow(table: 'stays' | 'transfers' | 'activities', id: string) {
  const { error } = await requireSupabase().from(table).delete().eq('id', id)
  throwIf(error)
}

export function transferTitle(transfer: Transfer): string {
  if (transfer.title) return transfer.title
  const first = transfer.waypoints[0]?.place.name
  const last = transfer.waypoints.at(-1)?.place.name
  if (first && last && transfer.waypoints.length > 1) return `${first} → ${last}`
  return transferModeLabels[transfer.mode]
}
