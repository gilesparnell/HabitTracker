import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  clampFutureISO,
  daysBetween,
  isFriSatEvening,
  isWeekendDateISO,
  localDateISO,
  todayLocalISO,
} from './calendar'

describe('calendar domain helpers', () => {
  it('formats a Date as a local ISO calendar date', () => {
    expect(localDateISO(new Date(2026, 6, 8, 23, 59))).toBe('2026-07-08')
  })

  it('formats today from an injected Date as a local ISO calendar date', () => {
    expect(todayLocalISO(new Date(2026, 0, 2, 1, 30))).toBe('2026-01-02')
  })

  it('counts calendar days between same day, consecutive days, and N-day spans', () => {
    expect(daysBetween('2026-07-08', '2026-07-08')).toBe(0)
    expect(daysBetween('2026-07-08', '2026-07-09')).toBe(1)
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7)
  })

  it('counts exact calendar days across a daylight-saving transition', () => {
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2)
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2)
  })

  it('adds calendar days across month and year boundaries', () => {
    expect(addDaysISO('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('detects Friday and Saturday evening only from local wall-clock time', () => {
    expect(isFriSatEvening(new Date(2026, 6, 3, 17, 59))).toBe(false)
    expect(isFriSatEvening(new Date(2026, 6, 3, 18, 0))).toBe(true)
    expect(isFriSatEvening(new Date(2026, 6, 4, 23, 59))).toBe(true)
    expect(isFriSatEvening(new Date(2026, 6, 5, 18, 0))).toBe(false)
    expect(isFriSatEvening(new Date(2026, 6, 3, 9, 0))).toBe(false)
  })

  it('detects weekend ISO dates using calendar date semantics', () => {
    expect(isWeekendDateISO('2026-07-04')).toBe(true)
    expect(isWeekendDateISO('2026-07-05')).toBe(true)
    expect(isWeekendDateISO('2026-07-06')).toBe(false)
  })

  it('clamps future ISO dates to today', () => {
    expect(clampFutureISO('2026-07-09', '2026-07-08')).toBe('2026-07-08')
    expect(clampFutureISO('2026-07-07', '2026-07-08')).toBe('2026-07-07')
    expect(clampFutureISO('2026-07-08', '2026-07-08')).toBe('2026-07-08')
  })
})
