import { describe, expect, it } from 'vitest'
import type { HabitEvent } from '../domain/events'
import { emptyData, type AppData } from '../store/schema'
import { buildScreenModel } from './viewmodel'

// Tuesday morning, Sydney time. 2026-07-10 is a Friday.
const TUESDAY = new Date('2026-07-07T10:00:00+10:00')
const FRIDAY_EVENING = new Date('2026-07-10T19:30:00+10:00')

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id' | 'habit' | 'type'>): HabitEvent {
  return {
    user_id: 'u1',
    event_date: '2026-06-30',
    recorded_at: '2026-06-30T09:00:00+10:00',
    ...overrides,
  }
}

function withEvents(events: HabitEvent[]): AppData {
  return { ...emptyData(), events }
}

describe('buildScreenModel', () => {
  it('asks for setup when no events exist, without any prompt or counters activity', () => {
    const model = buildScreenModel(emptyData(), TUESDAY)

    expect(model.needsSetup).toBe(true)
    expect(model.prompt).toBeNull()
  })

  it('derives counter days, best, and total clean from the fold', () => {
    // vape started 7 days before "today" (2026-07-07), checked in today so no prompt
    const model = buildScreenModel(
      withEvents([
        event({ id: 's1', habit: 'vape', type: 'start', event_date: '2026-06-30' }),
        event({
          id: 'c1',
          habit: 'vape',
          type: 'checkin',
          kind: 'daily',
          event_date: '2026-07-07',
          recorded_at: '2026-07-07T08:00:00+10:00',
        }),
      ]),
      TUESDAY,
    )

    const vape = model.counters.find((c) => c.habit === 'vape')
    expect(vape?.days).toBe(7)
    expect(vape?.best).toBe(7)
    expect(vape?.totalClean).toBe(7)
    expect(model.needsSetup).toBe(false)
  })

  it('uses configured motivational text and falls back to a default', () => {
    const data: AppData = {
      ...withEvents([event({ id: 's1', habit: 'vape', type: 'start' })]),
      config: [{ habit: 'vape', motivationalText: 'Custom reason', updatedAt: '2026-07-01T00:00:00+10:00' }],
    }

    const model = buildScreenModel(data, TUESDAY)
    const vape = model.counters.find((c) => c.habit === 'vape')
    const drink = model.counters.find((c) => c.habit === 'drink')

    expect(vape?.motivationalText).toBe('Custom reason')
    expect(drink?.motivationalText.length).toBeGreaterThan(0)
  })

  it('prompts for vape first when both habits are due', () => {
    const model = buildScreenModel(
      withEvents([
        event({ id: 's1', habit: 'vape', type: 'start', recorded_at: '2026-07-06T09:00:00+10:00' }),
        event({ id: 's2', habit: 'drink', type: 'start', recorded_at: '2026-07-06T09:00:00+10:00' }),
      ]),
      TUESDAY,
    )

    expect(model.prompt?.habit).toBe('vape')
    expect(model.prompt?.status).toBe('standard')
    expect(model.prompt?.question).toContain('vape')
  })

  it('moves to the drink prompt once vape is answered today', () => {
    const model = buildScreenModel(
      withEvents([
        event({ id: 's1', habit: 'vape', type: 'start', recorded_at: '2026-07-06T09:00:00+10:00' }),
        event({ id: 's2', habit: 'drink', type: 'start', recorded_at: '2026-07-06T09:00:00+10:00' }),
        event({
          id: 'c1',
          habit: 'vape',
          type: 'checkin',
          kind: 'daily',
          event_date: '2026-07-07',
          recorded_at: '2026-07-07T08:00:00+10:00',
        }),
      ]),
      TUESDAY,
    )

    expect(model.prompt?.habit).toBe('drink')
  })

  it('shows no prompt when both habits are answered today', () => {
    const model = buildScreenModel(
      withEvents([
        event({ id: 's1', habit: 'vape', type: 'start', recorded_at: '2026-07-07T08:00:00+10:00' }),
        event({ id: 's2', habit: 'drink', type: 'start', recorded_at: '2026-07-07T08:00:00+10:00' }),
      ]),
      TUESDAY,
    )

    expect(model.prompt).toBeNull()
  })

  it('marks a multi-day gap as a catchup prompt', () => {
    const model = buildScreenModel(
      withEvents([event({ id: 's1', habit: 'vape', type: 'start', recorded_at: '2026-07-03T09:00:00+10:00' })]),
      TUESDAY,
    )

    expect(model.prompt?.status).toBe('catchup')
    expect(model.prompt?.question).toContain('whole time')
  })

  it('shows the hard-window support line on Friday evening and not on Tuesday morning', () => {
    const data = withEvents([event({ id: 's1', habit: 'vape', type: 'start', recorded_at: '2026-07-10T09:00:00+10:00' })])

    expect(buildScreenModel(data, FRIDAY_EVENING).supportLine).not.toBeNull()
    expect(buildScreenModel(data, TUESDAY).supportLine).toBeNull()
  })

  it('suppresses prompt when configured check-in time has not been reached', () => {
    // 2026-07-08 at 06:00 (before default 07:00)
    const earlyMorning = new Date('2026-07-08T06:00:00+10:00')
    const data: AppData = {
      ...withEvents([event({ id: 's1', habit: 'vape', type: 'start', event_date: '2026-07-07' })]),
      config: [{ habit: 'vape', motivationalText: 'Test', checkInTime: '07:00', updatedAt: '2026-07-08T00:00:00+10:00' }],
    }

    const model = buildScreenModel(data, earlyMorning)
    expect(model.prompt).toBeNull()
  })

  it('shows prompt after configured check-in time is reached', () => {
    // 2026-07-08 at 07:00 (at configured time)
    const atConfiguredTime = new Date('2026-07-08T07:00:00+10:00')
    const data: AppData = {
      ...withEvents([event({ id: 's1', habit: 'vape', type: 'start', event_date: '2026-07-07' })]),
      config: [{ habit: 'vape', motivationalText: 'Test', checkInTime: '07:00', updatedAt: '2026-07-08T00:00:00+10:00' }],
    }

    const model = buildScreenModel(data, atConfiguredTime)
    expect(model.prompt?.habit).toBe('vape')
  })

  it('respects per-habit configured times when multiple habits have different times', () => {
    // 2026-07-08 at 07:30 (past vape time 07:00, before drink time 08:00)
    const time730 = new Date('2026-07-08T07:30:00+10:00')
    const data: AppData = {
      ...withEvents([
        event({ id: 's1', habit: 'vape', type: 'start', event_date: '2026-07-07' }),
        event({ id: 's2', habit: 'drink', type: 'start', event_date: '2026-07-07' }),
      ]),
      config: [
        { habit: 'vape', motivationalText: 'Test', checkInTime: '07:00', updatedAt: '2026-07-08T00:00:00+10:00' },
        { habit: 'drink', motivationalText: 'Test', checkInTime: '08:00', updatedAt: '2026-07-08T00:00:00+10:00' },
      ],
    }

    const model = buildScreenModel(data, time730)
    expect(model.prompt?.habit).toBe('vape')
  })
})
