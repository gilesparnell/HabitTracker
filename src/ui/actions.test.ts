import { describe, expect, it } from 'vitest'
import { fold } from '../domain/fold'
import type { HabitEvent } from '../domain/events'
import { appendEvent, setDeviceMilestone, upsertConfig } from '../store/local'
import { emptyData, type AppData } from '../store/schema'
import { correctStartDate, initDeviceMilestones, setMotivation, undoLastRelapse } from './actions'

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id' | 'habit' | 'type'>): HabitEvent {
  return {
    user_id: 'user-1',
    event_date: overrides.type === 'revoke' ? null : '2026-07-01',
    recorded_at: '2026-07-01T09:00:00+10:00',
    ...overrides,
  }
}

function withEvents(events: HabitEvent[]): AppData {
  return events.reduce((data, item) => appendEvent(data, item), emptyData())
}

describe('correctStartDate', () => {
  it('appends a new latest-recorded start event without removing historical events', () => {
    const data = withEvents([
      event({ id: 'start-vape', habit: 'vape', type: 'start', event_date: '2026-07-01' }),
      event({ id: 'relapse-vape', habit: 'vape', type: 'relapse', event_date: '2026-07-04', recorded_at: '2026-07-04T09:00:00+10:00' }),
    ])
    const before = fold(data.events, '2026-07-08').vape

    const next = correctStartDate(data, 'vape', '2026-07-01', '2026-07-08T08:00:00+10:00')
    const after = fold(next.events, '2026-07-08').vape
    const appended = next.events.at(-1)

    expect(appended).toMatchObject({
      user_id: 'local',
      habit: 'vape',
      type: 'start',
      event_date: '2026-07-01',
      recorded_at: '2026-07-08T08:00:00+10:00',
    })
    expect(appended?.id).toEqual(expect.any(String))
    expect(next.events).toHaveLength(data.events.length + 1)
    expect(next.dirtyEventIds).toContain(appended?.id)
    expect(after.longestStreakDays).toBe(before.longestStreakDays)
    expect(after.totalCleanDays).toBe(before.totalCleanDays)
  })
})

describe('undoLastRelapse', () => {
  it('revokes only the latest non-revoked relapse for the habit', () => {
    const first = event({ id: 'relapse-1', habit: 'vape', type: 'relapse', event_date: '2026-07-02', recorded_at: '2026-07-02T09:00:00+10:00' })
    const latest = event({ id: 'relapse-2', habit: 'vape', type: 'relapse', event_date: '2026-07-05', recorded_at: '2026-07-05T09:00:00+10:00' })
    const otherHabit = event({ id: 'relapse-drink', habit: 'drink', type: 'relapse', event_date: '2026-07-06', recorded_at: '2026-07-06T09:00:00+10:00' })
    const data = withEvents([first, latest, otherHabit])

    const next = undoLastRelapse(data, 'vape', '2026-07-08T08:00:00+10:00')
    const revoke = next.events.at(-1)

    expect(revoke).toMatchObject({
      user_id: 'local',
      habit: 'vape',
      type: 'revoke',
      event_date: null,
      target_id: 'relapse-2',
      recorded_at: '2026-07-08T08:00:00+10:00',
    })
  })

  it('returns the original data unchanged when there is no relapse to undo', () => {
    const data = withEvents([event({ id: 'start-vape', habit: 'vape', type: 'start' })])

    expect(undoLastRelapse(data, 'vape', '2026-07-08T08:00:00+10:00')).toBe(data)
  })

  it('double-undo revokes two different relapse events', () => {
    const data = withEvents([
      event({ id: 'relapse-1', habit: 'drink', type: 'relapse', event_date: '2026-07-02', recorded_at: '2026-07-02T09:00:00+10:00' }),
      event({ id: 'relapse-2', habit: 'drink', type: 'relapse', event_date: '2026-07-05', recorded_at: '2026-07-05T09:00:00+10:00' }),
    ])

    const once = undoLastRelapse(data, 'drink', '2026-07-08T08:00:00+10:00')
    const twice = undoLastRelapse(once, 'drink', '2026-07-08T08:05:00+10:00')

    expect(once.events.at(-1)?.target_id).toBe('relapse-2')
    expect(twice.events.at(-1)?.target_id).toBe('relapse-1')
  })
})

describe('setMotivation', () => {
  it('upserts motivational text with the given updatedAt timestamp', () => {
    const data = upsertConfig(emptyData(), {
      habit: 'vape',
      motivationalText: 'Old',
      updatedAt: '2026-07-01T09:00:00+10:00',
    })

    expect(setMotivation(data, 'vape', 'Clear lungs', '2026-07-08T08:00:00+10:00').config).toEqual([
      {
        habit: 'vape',
        motivationalText: 'Clear lungs',
        updatedAt: '2026-07-08T08:00:00+10:00',
      },
    ])
  })
})

describe('initDeviceMilestones', () => {
  it('sets each habit to the highest milestone at or below the current streak', () => {
    const data = setDeviceMilestone(setDeviceMilestone(emptyData(), 'vape', 365), 'drink', 365)
    const folded = {
      vape: {
        habit: 'vape',
        streakStartDate: '2026-07-08',
        currentStreakDays: 0,
        longestStreakDays: 0,
        totalCleanDays: 0,
        lastInteractionDate: '2026-07-08',
      },
      drink: {
        habit: 'drink',
        streakStartDate: '2026-06-08',
        currentStreakDays: 30,
        longestStreakDays: 30,
        totalCleanDays: 30,
        lastInteractionDate: '2026-07-08',
      },
    } as const

    const next = initDeviceMilestones(data, folded)

    expect(next.device.lastCelebratedMilestone.vape).toBe(0)
    expect(next.device.lastCelebratedMilestone.drink).toBe(30)
  })

  it('handles mid-streak and exact yearly milestone values', () => {
    const folded = {
      vape: {
        habit: 'vape',
        streakStartDate: '2026-06-18',
        currentStreakDays: 20,
        longestStreakDays: 20,
        totalCleanDays: 20,
        lastInteractionDate: '2026-07-08',
      },
      drink: {
        habit: 'drink',
        streakStartDate: '2025-07-08',
        currentStreakDays: 365,
        longestStreakDays: 365,
        totalCleanDays: 365,
        lastInteractionDate: '2026-07-08',
      },
    } as const

    const next = initDeviceMilestones(emptyData(), folded)

    expect(next.device.lastCelebratedMilestone.vape).toBe(7)
    expect(next.device.lastCelebratedMilestone.drink).toBe(365)
  })
})
