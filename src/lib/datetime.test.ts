import { describe, expect, it } from 'vitest'
import { addDays, formatDay, formatTime, fromDateTimeInput, localDayKey, toDateTimeInput } from './datetime'

describe('datetime-local Umwandlung', () => {
  it('ist umkehrbar', () => {
    const iso = fromDateTimeInput('2027-05-01T14:30')!
    expect(toDateTimeInput(iso)).toBe('2027-05-01T14:30')
    expect(localDayKey(iso)).toBe('2027-05-01')
  })

  it('behandelt leere Werte', () => {
    expect(fromDateTimeInput('')).toBeNull()
    expect(toDateTimeInput(null)).toBe('')
  })
})

describe('formatTime', () => {
  it('kürzt Postgres-Zeiten', () => {
    expect(formatTime('09:05:00')).toBe('09:05')
  })

  it('liest ISO-Zeitstempel in lokaler Zeit', () => {
    expect(formatTime(fromDateTimeInput('2027-05-01T07:45'))).toBe('07:45')
  })
})

describe('Tage', () => {
  it('zählt über Monatsgrenzen', () => {
    expect(addDays('2027-04-30', 1)).toBe('2027-05-01')
  })

  it('formatiert deutsch', () => {
    expect(formatDay('2027-05-01')).toBe('Samstag, 1. Mai')
  })
})
