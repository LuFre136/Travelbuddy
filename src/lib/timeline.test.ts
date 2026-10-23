import { describe, expect, it } from 'vitest'
import { fromDateTimeInput } from './datetime'
import type { Activity, Stay, Transfer } from './plan'
import { buildTimeline } from './timeline'

function stay(id: string, checkIn: string | null, checkOut: string | null): Stay {
  return {
    id,
    trip_id: 't',
    stage_id: null,
    title: `Unterkunft ${id}`,
    check_in: checkIn ? fromDateTimeInput(checkIn) : null,
    check_out: checkOut ? fromDateTimeInput(checkOut) : null,
    booking_ref: null,
    link: null,
    cost: null,
    currency: null,
    notes: null,
    place: null,
  }
}

function transfer(id: string, departAt: string | null): Transfer {
  return {
    id,
    trip_id: 't',
    stage_id: null,
    title: null,
    mode: 'train',
    depart_at: departAt ? fromDateTimeInput(departAt) : null,
    arrive_at: null,
    booking_ref: null,
    notes: null,
    waypoints: [],
  }
}

function activity(id: string, date: string | null, start: string | null): Activity {
  return {
    id,
    trip_id: 't',
    stage_id: null,
    title: `Aktivität ${id}`,
    status: 'planned',
    date,
    start_time: start,
    end_time: null,
    cost: null,
    currency: null,
    notes: null,
    place: null,
  }
}

describe('buildTimeline', () => {
  it('zeigt alle Reisetage, auch leere', () => {
    const t = buildTimeline(
      { start_date: '2027-05-01', end_date: '2027-05-03' },
      { stages: [], stays: [], transfers: [], activities: [] },
    )
    expect(t.days.map((d) => d.key)).toEqual(['2027-05-01', '2027-05-02', '2027-05-03'])
    expect(t.days.every((d) => d.entries.length === 0)).toBe(true)
  })

  it('ordnet Einträge den Tagen zu und sortiert nach Uhrzeit', () => {
    const t = buildTimeline(
      { start_date: '2027-05-01', end_date: '2027-05-02' },
      {
        stages: [],
        stays: [stay('a', '2027-05-01T15:00', '2027-05-02T10:00')],
        transfers: [transfer('x', '2027-05-02T12:30')],
        activities: [activity('m', '2027-05-01', '09:00:00'), activity('n', '2027-05-01', null)],
      },
    )
    expect(t.days[0].entries.map((e) => e.id)).toEqual(['ac-m', 'in-a', 'ac-n'])
    expect(t.days[1].entries.map((e) => e.id)).toEqual(['out-a', 'tr-x'])
  })

  it('kennt die Unterkunft für jede Nacht', () => {
    const t = buildTimeline(
      { start_date: '2027-05-01', end_date: '2027-05-03' },
      { stages: [], stays: [stay('a', '2027-05-01T15:00', '2027-05-03T10:00')], transfers: [], activities: [] },
    )
    expect(t.days.map((d) => d.night?.id ?? null)).toEqual(['a', 'a', null])
  })

  it('sammelt Einträge ohne Datum separat', () => {
    const t = buildTimeline(
      { start_date: null, end_date: null },
      {
        stages: [],
        stays: [stay('a', null, null)],
        transfers: [transfer('x', null)],
        activities: [activity('m', null, null)],
      },
    )
    expect(t.days).toEqual([])
    expect(t.undated.map((e) => e.kind).sort()).toEqual(['activity', 'checkin', 'transfer'])
  })

  it('zeigt Einträge außerhalb des Reisezeitraums trotzdem', () => {
    const t = buildTimeline(
      { start_date: '2027-05-02', end_date: '2027-05-02' },
      { stages: [], stays: [], transfers: [transfer('x', '2027-05-01T08:00')], activities: [] },
    )
    expect(t.days.map((d) => d.key)).toEqual(['2027-05-01', '2027-05-02'])
  })
})
