import { describe, expect, it } from 'vitest'
import type { HabitEvent } from '../domain/events'
import {
  appendEvent,
  exportJSON,
  importJSON,
  loadData,
  markSynced,
  saveData,
  setDeviceMilestone,
  setSession,
  setSyncCursor,
  upsertConfig,
  type StorageLike,
} from './local'
import { emptyData, STORAGE_KEY, type HabitConfig } from './schema'

class MemoryStorage implements StorageLike {
  values = new Map<string, string>()
  throwOnSet = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError')
    }
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id'>): HabitEvent {
  return {
    user_id: 'user-1',
    habit: 'vape',
    type: 'checkin',
    kind: 'daily',
    event_date: '2026-07-08',
    recorded_at: '2026-07-08T09:00:00+10:00',
    ...overrides,
  }
}

function config(overrides: Partial<HabitConfig> = {}): HabitConfig {
  return {
    habit: 'vape',
    motivationalText: 'Breathe clean',
    updatedAt: '2026-07-08T09:00:00+10:00',
    ...overrides,
  }
}

describe('loadData', () => {
  it('returns empty data with no warning when nothing is stored', () => {
    const result = loadData(new MemoryStorage())

    expect(result.data).toEqual(emptyData())
    expect(result.warning).toBeNull()
  })

  it('round-trips data saved with saveData', () => {
    const storage = new MemoryStorage()
    const data = appendEvent(emptyData(), event({ id: 'e1' }))

    saveData(storage, data)
    const result = loadData(storage)

    expect(result.data).toEqual(data)
    expect(result.warning).toBeNull()
  })

  it('degrades to empty data with a warning on malformed JSON, never throwing', () => {
    const storage = new MemoryStorage()
    storage.values.set(STORAGE_KEY, '{not json')

    const result = loadData(storage)

    expect(result.data).toEqual(emptyData())
    expect(result.warning).not.toBeNull()
  })

  it('degrades to empty data with a warning on an unknown schema version', () => {
    const storage = new MemoryStorage()
    storage.values.set(STORAGE_KEY, JSON.stringify({ ...emptyData(), schemaVersion: 999 }))

    const result = loadData(storage)

    expect(result.data).toEqual(emptyData())
    expect(result.warning).not.toBeNull()
  })

  it('rejects stored data containing an invalid event shape', () => {
    const storage = new MemoryStorage()
    const bad = { ...emptyData(), events: [{ ...event({ id: 'e1' }), habit: 'smoke' }] }
    storage.values.set(STORAGE_KEY, JSON.stringify(bad))

    const result = loadData(storage)

    expect(result.data).toEqual(emptyData())
    expect(result.warning).not.toBeNull()
  })
})

describe('saveData', () => {
  it('writes under the single storage key and reports success', () => {
    const storage = new MemoryStorage()

    const ok = saveData(storage, emptyData())

    expect(ok).toBe(true)
    expect(storage.values.has(STORAGE_KEY)).toBe(true)
  })

  it('reports failure instead of throwing when storage rejects the write (quota)', () => {
    const storage = new MemoryStorage()
    storage.throwOnSet = true

    expect(() => saveData(storage, emptyData())).not.toThrow()
    expect(saveData(storage, emptyData())).toBe(false)
  })
})

describe('appendEvent', () => {
  it('appends the event and marks its id dirty for sync', () => {
    const data = appendEvent(emptyData(), event({ id: 'e1' }))

    expect(data.events).toHaveLength(1)
    expect(data.dirtyEventIds).toEqual(['e1'])
  })

  it('does not duplicate a dirty id when the same event id is appended twice', () => {
    const once = appendEvent(emptyData(), event({ id: 'e1' }))
    const twice = appendEvent(once, event({ id: 'e1' }))

    expect(twice.dirtyEventIds).toEqual(['e1'])
  })
})

describe('markSynced', () => {
  it('clears only the given ids, leaving other dirty ids in place', () => {
    let data = appendEvent(emptyData(), event({ id: 'e1' }))
    data = appendEvent(data, event({ id: 'e2' }))

    const synced = markSynced(data, ['e1'])

    expect(synced.dirtyEventIds).toEqual(['e2'])
    expect(synced.events).toHaveLength(2)
  })
})

describe('upsertConfig (last-write-wins)', () => {
  it('inserts config for a habit that has none', () => {
    const data = upsertConfig(emptyData(), config())

    expect(data.config).toEqual([config()])
  })

  it('replaces config when the incoming updatedAt is newer', () => {
    const older = upsertConfig(emptyData(), config({ updatedAt: '2026-07-01T00:00:00+10:00' }))
    const newer = config({ motivationalText: 'New reason', updatedAt: '2026-07-08T00:00:00+10:00' })

    const data = upsertConfig(older, newer)

    expect(data.config).toEqual([newer])
  })

  it('keeps the existing config when the incoming updatedAt is older', () => {
    const current = config({ updatedAt: '2026-07-08T00:00:00+10:00' })
    const data = upsertConfig(emptyData(), current)

    const stale = upsertConfig(data, config({ motivationalText: 'Stale', updatedAt: '2026-07-01T00:00:00+10:00' }))

    expect(stale.config).toEqual([current])
  })
})

describe('device state, session, and cursor setters', () => {
  it('setDeviceMilestone updates only the named habit', () => {
    const data = setDeviceMilestone(emptyData(), 'vape', 30)

    expect(data.device.lastCelebratedMilestone.vape).toBe(30)
    expect(data.device.lastCelebratedMilestone.drink).toBe(0)
  })

  it('setSession and setSyncCursor store and clear values', () => {
    const session = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: null,
      userId: 'u1',
      email: 'giles@parnellsystems.com',
    }

    let data = setSession(emptyData(), session)
    data = setSyncCursor(data, 'cursor-1')

    expect(data.session).toEqual(session)
    expect(data.syncCursor).toBe('cursor-1')

    data = setSession(data, null)
    data = setSyncCursor(data, null)

    expect(data.session).toBeNull()
    expect(data.syncCursor).toBeNull()
  })
})

describe('export / import', () => {
  it('round-trips through exportJSON and importJSON', () => {
    let data = appendEvent(emptyData(), event({ id: 'e1' }))
    data = upsertConfig(data, config())

    const result = importJSON(exportJSON(data))

    expect(result.data).toEqual(data)
    expect(result.warning).toBeNull()
  })

  it('importJSON degrades to empty data with a warning on garbage input', () => {
    const result = importJSON('not even json')

    expect(result.data).toEqual(emptyData())
    expect(result.warning).not.toBeNull()
  })
})

describe('loadData with cloud-restored rows (regression: phone sign-out loop)', () => {
  it('accepts events whose optional fields are explicit nulls from Postgres', () => {
    // Cloud-pulled rows carry kind: null / target_id: null; locally-created
    // events omit them. Both must survive a save/load round-trip.
    const storage = new MemoryStorage()
    const stored = {
      ...emptyData(),
      events: [
        {
          id: 'e1',
          user_id: 'u1',
          habit: 'vape',
          type: 'start',
          event_date: '2026-06-01',
          kind: null,
          target_id: null,
          recorded_at: '2026-06-01T09:00:00+10:00',
          created_at: '2026-06-01T09:00:01+10:00',
        },
      ],
    }
    storage.values.set(STORAGE_KEY, JSON.stringify(stored))

    const result = loadData(storage)

    expect(result.warning).toBeNull()
    expect(result.data.events).toHaveLength(1)
    expect(result.data.events[0].id).toBe('e1')
    expect(result.data.events[0].kind).toBeUndefined()
    expect(result.data.events[0].target_id).toBeUndefined()
  })

  it('still rejects events with genuinely invalid kind values', () => {
    const storage = new MemoryStorage()
    const stored = { ...emptyData(), events: [{ ...event({ id: 'e1' }), kind: 'weekly' }] }
    storage.values.set(STORAGE_KEY, JSON.stringify(stored))

    const result = loadData(storage)

    expect(result.data).toEqual(emptyData())
    expect(result.warning).not.toBeNull()
  })
})
