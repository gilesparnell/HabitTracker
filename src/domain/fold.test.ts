import { describe, expect, it } from 'vitest'
import type { Habit, HabitEvent } from './events'
import { fold, foldHabit, type HabitState, checkinStatus } from './fold'

const USER_ID = 'user-1'

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id' | 'habit' | 'type'>): HabitEvent {
  return {
    user_id: USER_ID,
    event_date: overrides.type === 'revoke' ? null : '2026-07-01',
    recorded_at: '2026-07-01T09:00:00+10:00',
    ...overrides,
  }
}

function expectedState(overrides: Partial<HabitState> & Pick<HabitState, 'habit'>): HabitState {
  const { habit, ...rest } = overrides
  return {
    habit,
    streakStartDate: null,
    currentStreakDays: 0,
    longestStreakDays: 0,
    totalCleanDays: 0,
    lastInteractionDate: null,
    ...rest,
  }
}

function stateForStatus(lastInteractionDate: string | null): HabitState {
  return expectedState({ habit: 'vape', lastInteractionDate })
}

describe('foldHabit', () => {
  it('folds an empty log to zero state and no check-in prompt', () => {
    const state = foldHabit([], 'vape', '2026-07-08')

    expect(state).toEqual(expectedState({ habit: 'vape' }))
    expect(checkinStatus(state, '2026-07-08')).toBe('none')
  })

  it('folds each habit for an empty log', () => {
    expect(fold([], '2026-07-08')).toEqual({
      vape: expectedState({ habit: 'vape' }),
      drink: expectedState({ habit: 'drink' }),
    })
  })

  it('treats a single start today as day zero with today as the last interaction', () => {
    const state = foldHabit(
      [event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-08', recorded_at: '2026-07-08T07:00:00+10:00' })],
      'vape',
      '2026-07-08',
    )

    expect(state).toEqual(
      expectedState({
        habit: 'vape',
        streakStartDate: '2026-07-08',
        currentStreakDays: 0,
        longestStreakDays: 0,
        totalCleanDays: 0,
        lastInteractionDate: '2026-07-08',
      }),
    )
    expect(checkinStatus(state, '2026-07-08')).toBe('none')
  })

  it('counts an N-day gap from the start date to today', () => {
    const state = foldHabit(
      [event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' })],
      'vape',
      '2026-07-08',
    )

    expect(state.currentStreakDays).toBe(7)
    expect(state.longestStreakDays).toBe(7)
    expect(state.totalCleanDays).toBe(7)
  })

  it('resets to day zero on a relapse day and excludes the relapse day from the ended streak', () => {
    const events = [
      event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
      event({ id: 'relapse-vape', habit: 'vape', type: 'relapse', event_date: '2026-07-04', recorded_at: '2026-07-04T08:00:00+10:00' }),
    ]

    expect(foldHabit(events, 'vape', '2026-07-04')).toEqual(
      expectedState({
        habit: 'vape',
        streakStartDate: '2026-07-04',
        currentStreakDays: 0,
        longestStreakDays: 3,
        totalCleanDays: 3,
        lastInteractionDate: '2026-07-04',
      }),
    )
    expect(foldHabit(events, 'vape', '2026-07-05')).toMatchObject({
      streakStartDate: '2026-07-04',
      currentStreakDays: 1,
      longestStreakDays: 3,
      totalCleanDays: 4,
    })
  })

  it('uses recorded_at for lastInteractionDate when a relapse is backdated through catch-up', () => {
    const state = foldHabit(
      [
        event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
        event({ id: 'relapse-vape', habit: 'vape', type: 'relapse', event_date: '2026-07-05', recorded_at: '2026-07-08T19:30:00+10:00' }),
      ],
      'vape',
      '2026-07-08',
    )

    expect(state).toMatchObject({
      streakStartDate: '2026-07-05',
      currentStreakDays: 3,
      longestStreakDays: 4,
      totalCleanDays: 7,
      lastInteractionDate: '2026-07-08',
    })
    expect(checkinStatus(state, '2026-07-08')).toBe('none')
  })

  it('restores the prior single-streak state when a relapse is revoked', () => {
    const events = [
      event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
      event({ id: 'relapse-vape', habit: 'vape', type: 'relapse', event_date: '2026-07-04', recorded_at: '2026-07-04T08:00:00+10:00' }),
      event({ id: 'revoke-relapse', habit: 'vape', type: 'revoke', event_date: null, target_id: 'relapse-vape', recorded_at: '2026-07-05T10:00:00+10:00' }),
    ]

    expect(foldHabit(events, 'vape', '2026-07-08')).toMatchObject({
      streakStartDate: '2026-07-01',
      currentStreakDays: 7,
      longestStreakDays: 7,
      totalCleanDays: 7,
    })
  })

  it('uses the latest recorded start as a correction without creating a phantom ended interval', () => {
    const state = foldHabit(
      [
        event({ id: 'start-original', habit: 'vape', type: 'start', event_date: '2026-07-04', recorded_at: '2026-07-04T09:00:00+10:00' }),
        event({ id: 'start-corrected', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-06T09:00:00+10:00' }),
      ],
      'vape',
      '2026-07-08',
    )

    expect(state).toMatchObject({
      streakStartDate: '2026-07-01',
      currentStreakDays: 7,
      longestStreakDays: 7,
      totalCleanDays: 7,
    })
  })

  it('computes longest and total clean days across multiple relapses', () => {
    const state = foldHabit(
      [
        event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
        event({ id: 'relapse-1', habit: 'vape', type: 'relapse', event_date: '2026-07-04', recorded_at: '2026-07-04T09:00:00+10:00' }),
        event({ id: 'relapse-2', habit: 'vape', type: 'relapse', event_date: '2026-07-10', recorded_at: '2026-07-10T09:00:00+10:00' }),
      ],
      'vape',
      '2026-07-12',
    )

    expect(state).toMatchObject({
      streakStartDate: '2026-07-10',
      currentStreakDays: 2,
      longestStreakDays: 6,
      totalCleanDays: 11,
    })
  })

  it('clamps future-dated events to today for computation and prompting', () => {
    const state = foldHabit(
      [
        event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
        event({ id: 'relapse-future', habit: 'vape', type: 'relapse', event_date: '2026-07-12', recorded_at: '2026-07-12T09:00:00+10:00' }),
      ],
      'vape',
      '2026-07-08',
    )

    expect(state).toMatchObject({
      streakStartDate: '2026-07-08',
      currentStreakDays: 0,
      longestStreakDays: 7,
      totalCleanDays: 7,
      lastInteractionDate: '2026-07-08',
    })
    expect(checkinStatus(state, '2026-07-08')).toBe('none')
  })

  it('ignores events for other habits', () => {
    const state = foldHabit(
      [
        event({ id: 'start-drink', habit: 'drink', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
        event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-03', recorded_at: '2026-07-03T09:00:00+10:00' }),
      ],
      'drink',
      '2026-07-08',
    )

    expect(state).toMatchObject({
      habit: 'drink' satisfies Habit,
      streakStartDate: '2026-07-01',
      currentStreakDays: 7,
    })
  })

  it('supports all checkinStatus branches', () => {
    expect(checkinStatus(stateForStatus(null), '2026-07-08')).toBe('none')
    expect(checkinStatus(stateForStatus('2026-07-08'), '2026-07-08')).toBe('none')
    expect(checkinStatus(stateForStatus('2026-07-07'), '2026-07-08')).toBe('standard')
    expect(checkinStatus(stateForStatus('2026-07-06'), '2026-07-08')).toBe('catchup')
    expect(checkinStatus(stateForStatus('2026-07-09'), '2026-07-08')).toBe('none')
  })

  it("suppresses today's prompt after a backdated relapse recorded today", () => {
    const state = foldHabit(
      [
        event({ id: 'start-drink', habit: 'drink', type: 'start', event_date: '2026-07-01', recorded_at: '2026-07-01T09:00:00+10:00' }),
        event({ id: 'relapse-drink', habit: 'drink', type: 'relapse', event_date: '2026-07-05', recorded_at: '2026-07-08T21:00:00+10:00' }),
      ],
      'drink',
      '2026-07-08',
    )

    expect(state.lastInteractionDate).toBe('2026-07-08')
    expect(checkinStatus(state, '2026-07-08')).toBe('none')
  })
})
