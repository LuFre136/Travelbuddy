import { describe, expect, it } from 'vitest'
import { fromDateTimeInput } from './datetime'
import { buildMapData, toGeoJson, type MapKind } from './mapdata'
import type { TripPlan } from './plan'

const place = (name: string, lat: number | null, lng: number | null) => ({ id: name, name, lat, lng, address: null })
const all = new Set<MapKind>(['stay', 'activity', 'waypoint'])

const plan: TripPlan = {
  stages: [],
  stays: [
    {
      id: 's1',
      trip_id: 't',
      stage_id: null,
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
      stage_id: null,
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
      stage_id: null,
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
      stage_id: null,
      title: null,
      mode: 'train',
      depart_at: fromDateTimeInput('2027-05-03T11:30'),
      arrive_at: null,
      booking_ref: null,
      notes: null,
      waypoints: [
        {
          id: 'w1',
          position: 1,
          day: null,
          time: null,
          segment_mode: null,
          stop_note: null,
          place: place('Lissabon', 38.71, -9.12),
        },
        {
          id: 'w2',
          position: 2,
          day: null,
          time: null,
          segment_mode: null,
          stop_note: null,
          place: place('Coimbra', 40.21, -8.43),
        },
        {
          id: 'w3',
          position: 3,
          day: '2027-05-04',
          time: null,
          segment_mode: 'bus',
          stop_note: null,
          place: place('Porto', 41.15, -8.61),
        },
      ],
    },
  ],
}

describe('buildMapData', () => {
  it('zeigt alle Orte mit Position und eine Linie pro Abschnitt', () => {
    const data = buildMapData(plan, { day: 'all', kinds: all })
    expect(data.points.map((p) => p.id)).toEqual([
      'stay-s1',
      'activity-a1',
      'waypoint-w1',
      'waypoint-w2',
      'waypoint-w3',
    ])
    expect(data.lines.map((l) => [l.mode, l.title])).toEqual([
      ['train', 'Zug: Lissabon → Coimbra'],
      ['bus', 'Bus: Coimbra → Porto'],
    ])
    expect(data.lines[1].coordinates).toEqual([
      [-8.43, 40.21],
      [-8.61, 41.15],
    ])
  })

  it('listet Orte ohne Position separat', () => {
    expect(buildMapData(plan, { day: 'all', kinds: all }).unplaced).toEqual([{ id: 'activity-a2', title: 'Omas Café' }])
  })

  it('filtert nach Tag; Unterkünfte gelten für ihren ganzen Zeitraum', () => {
    const day2 = buildMapData(plan, { day: '2027-05-02', kinds: all })
    expect(day2.points.map((p) => p.id)).toEqual(['stay-s1'])
    const day3 = buildMapData(plan, { day: '2027-05-03', kinds: all })
    // Porto hat ein eigenes Datum (4. Mai), der Abschnitt dorthin bleibt aber sichtbar.
    expect(day3.points.map((p) => p.id)).toEqual(['stay-s1', 'waypoint-w1', 'waypoint-w2'])
    expect(day3.lines).toHaveLength(2)
    expect(day3.unplaced).toEqual([])
    const day4 = buildMapData(plan, { day: '2027-05-04', kinds: all })
    expect(day4.points.map((p) => p.id)).toContain('waypoint-w3')
    expect(day4.lines.map((l) => l.id)).toEqual(['segment-w3'])
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

  it('färbt nach Etappe und nummeriert die Reisetage', () => {
    const withStages = {
      ...plan,
      stages: [
        { id: 'st', trip_id: 't', name: 'Lissabon', color: '#c2410c', start_day: '2027-05-01', end_day: '2027-05-02' },
      ],
    }
    const data = buildMapData(withStages, { day: 'all', kinds: all }, '2027-05-01')
    const stay = data.points.find((p) => p.id === 'stay-s1')!
    expect(stay.color).toBe('#c2410c')
    expect(stay.dayNumber).toBe(1)
    const porto = data.points.find((p) => p.id === 'waypoint-w3')!
    expect(porto.color).toBeNull()
    expect(porto.dayNumber).toBe(4)
    const geo = toGeoJson(data)
    expect(geo.points.features.find((f) => f.id === 'stay-s1')!.properties).toMatchObject({
      label: '1',
      color: '#c2410c',
    })
  })
})
