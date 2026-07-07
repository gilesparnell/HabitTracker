import { describe, expect, it } from 'vitest'
import type { HabitEvent } from '../domain/events'
import { SCHEMA_VERSION, emptyState, parsePersistedState, type PersistedState } from './schema'

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id' | 'habit' | 'type'>): HabitEvent {
  return {
    user_id: 'user-1',
    event_date: overrides.type === 'revoke' ? null : '2026-07-01',
    recorded_at: '2026-07-01T09:00:00+10:00',
    ...overrides,
  }
}

function populatedState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    events: [
      event({ id: 'start-vape', habit: 'vape', type: 'start' }),
      event({ id: 'checkin-drink', habit: 'drink', type: 'checkin', kind: 'daily', event_date: '2026-07-02' }),
    ],
    config: {
      vape: { motivationalText: 'Breathe clean' },
      drink: { motivationalText: 'Wake clear' },
    },
    deviceState: {
      vape: { lastCelebratedMilestone: 7 },
      drink: { lastCelebratedMilestone: 30 },
    },
    session: { access_token: 'token' },
    syncCursor: 'cursor-1',
    dirtyEventIds: ['start-vape'],
  }
}

describe('emptyState', () => {
  it('creates schema version 1 with per-habit config and device defaults', () => {
    expect(emptyState()).toEqual({
      schemaVersion: SCHEMA_VERSION,
      events: [],
      config: {
        vape: { motivationalText: '' },
        drink: { motivationalText: '' },
      },
      deviceState: {
        vape: { lastCelebratedMilestone: 0 },
        drink: { lastCelebratedMilestone: 0 },
      },
      session: null,
      syncCursor: null,
      dirtyEventIds: [],
    })
  })

  it('returns a fresh mutable object on every call', () => {
    const first = emptyState()
    const second = emptyState()

    first.events.push(event({ id: 'start-vape', habit: 'vape', type: 'start' }))
    first.config.vape.motivationalText = 'Changed'
    first.deviceState.vape.lastCelebratedMilestone = 90

    expect(second.events).toEqual([])
    expect(second.config.vape.motivationalText).toBe('')
    expect(second.deviceState.vape.lastCelebratedMilestone).toBe(0)
  })
})

describe('parsePersistedState', () => {
  it('parses valid persisted state without marking it corrupt', () => {
    const state = populatedState()

    expect(parsePersistedState(JSON.stringify(state))).toEqual({ state, corrupt: false })
  })

  it('returns empty state without corruption when no value is stored', () => {
    expect(parsePersistedState(null)).toEqual({ state: emptyState(), corrupt: false })
  })

  it('returns empty corrupt state for malformed JSON and never throws', () => {
    expect(parsePersistedState('{not json')).toEqual({ state: emptyState(), corrupt: true })
  })

  it('returns empty corrupt state for the wrong schema version', () => {
    expect(parsePersistedState(JSON.stringify({ ...populatedState(), schemaVersion: 999 }))).toEqual({
      state: emptyState(),
      corrupt: true,
    })
  })

  it('returns empty corrupt state when required fields are missing', () => {
    const { events: _events, ...missingEvents } = populatedState()

    expect(parsePersistedState(JSON.stringify(missingEvents))).toEqual({ state: emptyState(), corrupt: true })
  })

  it('returns empty corrupt state when event shapes are invalid', () => {
    const state = populatedState()

    expect(parsePersistedState(JSON.stringify({ ...state, events: [{ ...state.events[0], habit: 'smoke' }] }))).toEqual({
      state: emptyState(),
      corrupt: true,
    })
  })
}
