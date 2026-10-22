import { describe, expect, it } from 'vitest'
import { formatCost, formatDateRange, inviteUrl, parseCost } from './format'
import { canEditPlan } from './types'

describe('formatDateRange', () => {
  it('zeigt offenes Datum', () => {
    expect(formatDateRange(null, null)).toBe('Datum offen')
  })

  it('zeigt nur Start', () => {
    expect(formatDateRange('2027-05-01', null)).toBe('ab 1. Mai 2027')
  })

  it('zeigt Zeitraum', () => {
    expect(formatDateRange('2027-05-01', '2027-05-14')).toMatch(/1\.\s*[–-]\s*14\. Mai 2027/)
  })
})

describe('inviteUrl', () => {
  it('baut den Beitrittslink', () => {
    expect(inviteUrl('https://travelbuddy.pages.dev/', 'abc123')).toBe('https://travelbuddy.pages.dev/join/abc123')
  })
})

describe('canEditPlan', () => {
  it('erlaubt nur Host und Travelguide', () => {
    expect(canEditPlan('host')).toBe(true)
    expect(canEditPlan('guide')).toBe(true)
    expect(canEditPlan('buddy')).toBe(false)
    expect(canEditPlan(null)).toBe(false)
  })
})

describe('Kosten', () => {
  it('liest Komma und Punkt', () => {
    expect(parseCost('12,50')).toBe(12.5)
    expect(parseCost('12.50')).toBe(12.5)
    expect(parseCost('')).toBeNull()
    expect(parseCost('abc')).toBeNull()
  })

  it('formatiert in der Währung', () => {
    expect(formatCost(12.5, 'EUR')).toMatch(/12,50\s€/)
    expect(formatCost(null, 'EUR')).toBeNull()
  })
})
