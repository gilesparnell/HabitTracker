import { describe, expect, it } from 'vitest'
import { HABITS } from '../domain/events'
import { emptyData, SCHEMA_VERSION } from './schema'

describe('emptyData', () => {
  it('returns the current schema version with no events, config, or dirty ids', () => {
    const data = emptyData()

    expect(data.schemaVersion).toBe(SCHEMA_VERSION)
    expect(data.events).toEqual([])
    expect(data.config).toEqual([])
    expect(data.dirtyEventIds).toEqual([])
    expect(data.session).toBeNull()
    expect(data.syncCursor).toBeNull()
  })

  it('starts every habit with milestone 0 so nothing celebrates retroactively', () => {
    const data = emptyData()

    for (const habit of HABITS) {
      expect(data.device.lastCelebratedMilestone[habit]).toBe(0)
    }
  })

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = emptyData()
    const b = emptyData()

    a.events.push({
      id: 'e1',
      user_id: 'u1',
      habit: 'vape',
      type: 'start',
      event_date: '2026-07-01',
      recorded_at: '2026-07-01T09:00:00+10:00',
    })

    expect(b.events).toEqual([])
  })
})
