import { describe, expect, it } from 'vitest'
import type { Stage } from './plan'
import { nextStageColor, stageColors, stageDayLabel, stageDays, stageForDay, stageOf, tripDayNumber } from './stages'

const stage = (id: string, start: string | null, end: string | null, color = '#000000'): Stage => ({
  id,
  trip_id: 't',
  name: id,
  color,
  start_day: start,
  end_day: end,
})

const palma = stage('Palma', '2027-05-01', '2027-05-03')
const alcudia = stage('Alcudia', '2027-05-04', '2027-05-06')

describe('Etappen', () => {
  it('zählt Reisetage ab dem Anreisetag, auch über Monatsgrenzen', () => {
    expect(tripDayNumber('2027-05-01', '2027-05-01')).toBe(1)
    expect(tripDayNumber('2027-04-29', '2027-05-02')).toBe(4)
    // Zeitumstellung Ende Oktober verschiebt nichts
    expect(tripDayNumber('2027-10-30', '2027-11-01')).toBe(3)
    expect(tripDayNumber(null, '2027-05-01')).toBeNull()
  })

  it('beschriftet Tagesbereiche', () => {
    expect(stageDayLabel('2027-05-01', palma)).toBe('Tag 1–3')
    expect(stageDayLabel('2027-05-01', stage('x', '2027-05-04', null))).toBe('Tag 4')
    expect(stageDayLabel(null, palma)).toBeNull()
  })

  it('listet die Tage einer Etappe', () => {
    expect(stageDays(palma)).toEqual(['2027-05-01', '2027-05-02', '2027-05-03'])
    expect(stageDays(stage('x', null, null))).toEqual([])
  })

  it('findet die Etappe zu einem Eintrag', () => {
    const stages = [palma, alcudia]
    expect(stageForDay(stages, '2027-05-05')?.id).toBe('Alcudia')
    expect(stageForDay(stages, '2027-05-09')).toBeNull()
    expect(stageOf(stages, { stage_id: 'Palma' }, '2027-05-05')?.id).toBe('Palma')
    expect(stageOf(stages, { stage_id: null }, '2027-05-02')?.id).toBe('Palma')
  })

  it('wählt eine noch freie Farbe', () => {
    expect(nextStageColor([stage('a', null, null, stageColors[0])])).toBe(stageColors[1])
  })
})
