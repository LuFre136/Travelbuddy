import { describe, expect, it } from 'vitest'
import { fromDateTimeInput } from './datetime'
import { buildMapData, toGeoJson, type MapKind } from './mapdata'
import type { TripPlan } from './plan'

const place = (name: string, lat: number | null, lng: number | null) => ({ id: name, name, lat, lng, address: null })
const all = new Set<MapKind>(['stay', 'activity', 'waypoint'])

const plan: TripPlan = {
  stays: [
    {
      id: 's1',
      trip_id: 't',
      title: 'Hostel Alfama',
      check_in: fromDateTimeInput('2027-05-01T15:00'),
      check_out: fromDateTimeInput('2027-05-03T10:00'),
      booking_ref: null,
      link: null,
      cost: null,
      currency: null,
      notes: null,
      place: place('Hostel Alfama', 38.71, -9.13),
    },
  ],
  activities: [
    {
      id: 'a1',
      trip_id: 't',
      title: 'Time Out Market',
      status: 'planned',
      date: '2027-05-01',
      start_time: null,
      end_time: null,
      cost: null,
      currency: null,
      notes: null,
      place: place('Time Out Market', 38.707, -9.146),
    },
    {
      id: 'a2',
      trip_id: 't',
      title: 'Omas Café',
      status: 'optional',
      date: null,
      start_time: null,
      end_time: null,
      cost: null,
      currency: null,
      notes: null,
      place: place('Omas Café', null, null),
    },
  ],
  transfers: [
    {
      id: 'x',
      trip_id: 't',
      title: null,
      mode: 'train',
      depart_at: fromDateTimeInput('2027-05-03T11:30'),
      arrive_at: null,
      booking_ref: null,
      notes: null,
      waypoints: [
        { id: 'w1', position: 1, planned_time: null, stop_note: null, place: place('Lissabon', 38.71, -9.12) },
        { id: 'w2', position: 2, planned_time: null, stop_note: null, place: place('Coimbra', 40.21, -8.43) },
        { id: 'w3', position: 3, planned_time: null, stop_note: null, place: place('Porto', 41.15, -8.61) },
      ],
    },
  ],
}

describe('buildMapData', () => {
  it('zeigt alle Orte mit Position und eine Linie pro Transfer', () => {
    const data = buildMapData(plan, { day: 'all', kinds: all })
    expect(data.points.map((p) => p.id)).toEqual([
      'stay-s1',
      'activity-a1',
      'waypoint-w1',
      'waypoint-w2',
      'waypoint-w3',
    ])
    expect(data.lines).toHaveLength(1)
    expect(data.lines[0].coordinates).toEqual([
      [-9.12, 38.71],
      [-8.43, 40.21],
      [-8.61, 41.15],
    ])
    expect(data.lines[0].title).toBe('Lissabon → Porto')
  })

  it('listet Orte ohne Position separat', () => {
    expect(buildMapData(plan, { day: 'all', kinds: all }).unplaced).toEqual([{ id: 'activity-a2', title: 'Omas Café' }])
  })

  it('filtert nach Tag; Unterkünfte gelten für ihren ganzen Zeitraum', () => {
    const day2 = buildMapData(plan, { day: '2027-05-02', kinds: all })
    expect(day2.points.map((p) => p.id)).toEqual(['stay-s1'])
    const day3 = buildMapData(plan, { day: '2027-05-03', kinds: all })
    expect(day3.points.map((p) => p.kind)).toEqual(['stay', 'waypoint', 'waypoint', 'waypoint'])
    expect(day3.unplaced).toEqual([])
  })

  it('filtert nach Art', () => {
    const data = buildMapData(plan, { day: 'all', kinds: new Set<MapKind>(['activity']) })
    expect(data.points.map((p) => p.id)).toEqual(['activity-a1'])
    expect(data.lines).toEqual([])
  })

  it('berechnet die Grenzen', () => {
    expect(buildMapData(plan, { day: 'all', kinds: all }).bounds).toEqual([-9.146, 38.707, -8.43, 41.15])
    expect(buildMapData(plan, { day: '2099-01-01', kinds: all }).bounds).toBeNull()
  })

  it('erzeugt GeoJSON', () => {
    const geo = toGeoJson(buildMapData(plan, { day: 'all', kinds: all }))
    expect(geo.points.features[0].geometry.coordinates).toEqual([-9.13, 38.71])
    expect(geo.lines.features[0].geometry.type).toBe('LineString')
  })
})
