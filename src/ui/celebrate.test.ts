import { describe, expect, it } from 'vitest'
import type { Habit, HabitEvent } from '../domain/events'
import { appendEvent, setDeviceMilestone } from '../store/local'
import { emptyData, type AppData } from '../store/schema'
import { celebrationFor } from './celebrate'

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id' | 'habit' | 'type'>): HabitEvent {
  return {
    user_id: 'user-1',
    event_date: overrides.type === 'revoke' ? null : '2026-07-01',
    recorded_at: '2026-07-01T09:00:00+10:00',
    ...overrides,
  }
}

function dataFor(habit: Habit, startDate: string, lastCelebrated: number): AppData {
  return setDeviceMilestone(
    appendEvent(emptyData(), event({ id: `start-${habit}`, habit, type: 'start', event_date: startDate })),
    habit,
    lastCelebrated,
  )
}

describe('celebrationFor', () => {
  it('fires a milestone when the current streak crosses beyond the last celebrated milestone', () => {
    const data = dataFor('vape', '2026-06-08', 7)

    expect(celebrationFor(data, 'vape', '2026-07-08', new Date(2026, 6, 8, 9, 0))).toEqual({
      milestone: 30,
      madeItThrough: false,
    })
  })

  it('returns null for milestone when no new milestone was crossed', () => {
    const data = dataFor('drink', '2026-06-08', 30)

    expect(celebrationFor(data, 'drink', '2026-07-08', new Date(2026, 6, 8, 9, 0))).toEqual({
      milestone: null,
      madeItThrough: false,
    })
  })

  it('returns only the highest new milestone when several were crossed in a catch-up gap', () => {
    const data = dataFor('vape', '2026-01-09', 7)

    expect(celebrationFor(data, 'vape', '2026-07-08', new Date(2026, 6, 8, 9, 0))).toEqual({
      milestone: 180,
      madeItThrough: false,
    })
  })

  it('marks made-it-through true for a clean Saturday check-in', () => {
    const data = dataFor('drink', '2026-07-01', 1)

    expect(celebrationFor(data, 'drink', '2026-07-04', new Date(2026, 6, 4, 9, 0))).toEqual({
      milestone: null,
      madeItThrough: true,
    })
  })

  it('marks made-it-through true for a clean Sunday check-in', () => {
    const data = dataFor('drink', '2026-07-01', 1)

    expect(celebrationFor(data, 'drink', '2026-07-05', new Date(2026, 6, 5, 9, 0))).toEqual({
      milestone: null,
      madeItThrough: true,
    })
  })

  it('marks made-it-through false for a midweek clean check-in', () => {
    const data = dataFor('vape', '2026-07-01', 0)

    expect(celebrationFor(data, 'vape', '2026-07-08', new Date(2026, 6, 8, 9, 0))).toEqual({
      milestone: 7,
      madeItThrough: false,
    })
  })
})
