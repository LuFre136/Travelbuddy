import { describe, expect, it } from 'vitest'
import { transferTitle, type Transfer } from './plan'

const place = (name: string) => ({ id: name, name, lat: null, lng: null, address: null })

function transfer(title: string | null, stops: string[]): Transfer {
  return {
    id: 't',
    trip_id: 'trip',
    title,
    mode: 'train',
    depart_at: null,
    arrive_at: null,
    booking_ref: null,
    notes: null,
    waypoints: stops.map((name, i) => ({
      id: name,
      position: i + 1,
      day: null,
      time: null,
      segment_mode: null,
      stop_note: null,
      place: place(name),
    })),
  }
}

describe('transferTitle', () => {
  it('nimmt die Bezeichnung, wenn vorhanden', () => {
    expect(transferTitle(transfer('IC 523', ['Lissabon', 'Porto']))).toBe('IC 523')
  })

  it('baut sonst Start → Ziel', () => {
    expect(transferTitle(transfer(null, ['Lissabon', 'Coimbra', 'Porto']))).toBe('Lissabon → Porto')
  })

  it('fällt auf das Verkehrsmittel zurück', () => {
    expect(transferTitle(transfer(null, []))).toBe('Zug')
  })
})
