import { describe, expect, it } from 'vitest'
import type { HabitEvent } from '../domain/events'
import { appendEvent, markSynced, setSyncCursor, upsertConfig } from '../store/local'
import { emptyData, type HabitConfig } from '../store/schema'
import { mergeConfig, mergeEvents, resolveStartupState, syncOnce } from './engine'
import type { SyncTransport } from './transport'

function event(overrides: Partial<HabitEvent> & Pick<HabitEvent, 'id'>): HabitEvent {
  const { id, ...rest } = overrides

  return {
    id,
    user_id: 'user-1',
    habit: 'vape',
    type: 'checkin',
    kind: 'daily',
    event_date: '2026-07-08',
    recorded_at: '2026-07-08T09:00:00+10:00',
    created_at: '2026-07-08T09:00:00+10:00',
    ...rest,
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

class FakeTransport implements SyncTransport {
  pushedEvents: HabitEvent[][] = []
  pushedConfig: HabitConfig[][] = []
  seenCursor: string | null | undefined

  pushEventsResult: Awaited<ReturnType<SyncTransport['pushEvents']>> = { ok: true, insertedIds: [] }
  pullEventsResult: Awaited<ReturnType<SyncTransport['pullEvents']>> = {
    ok: true,
    events: [],
    nextCursor: null,
  }
  pushConfigResult: Awaited<ReturnType<SyncTransport['pushConfig']>> = { ok: true }
  pullConfigResult: Awaited<ReturnType<SyncTransport['pullConfig']>> = { ok: true, config: [] }

  async pushEvents(events: HabitEvent[]): Promise<Awaited<ReturnType<SyncTransport['pushEvents']>>> {
    this.pushedEvents.push(events)
    return this.pushEventsResult
  }

  async pullEvents(sinceCursor: string | null): Promise<Awaited<ReturnType<SyncTransport['pullEvents']>>> {
    this.seenCursor = sinceCursor
    return this.pullEventsResult
  }

  async pushConfig(configRows: HabitConfig[]): Promise<Awaited<ReturnType<SyncTransport['pushConfig']>>> {
    this.pushedConfig.push(configRows)
    return this.pushConfigResult
  }

  async pullConfig(): Promise<Awaited<ReturnType<SyncTransport['pullConfig']>>> {
    return this.pullConfigResult
  }
}

describe('mergeEvents', () => {
  it('preserves both devices events by unioning by id instead of last-write-winning aggregates', () => {
    const local = event({ id: 'local-a', recorded_at: '2026-07-08T09:00:00+10:00' })
    const remote = event({ id: 'remote-b', recorded_at: '2026-07-08T09:05:00+10:00' })

    expect(mergeEvents([local], [remote])).toEqual([local, remote])
  })

  it('orders by recorded_at then id while never duplicating an event already present locally', () => {
    const sharedLocal = event({ id: 'shared', recorded_at: '2026-07-08T09:00:00+10:00' })
    const sharedRemote = event({ ...sharedLocal })
    const earlierB = event({ id: 'b', recorded_at: '2026-07-08T08:00:00+10:00' })
    const earlierA = event({ id: 'a', recorded_at: '2026-07-08T08:00:00+10:00' })

    expect(mergeEvents([sharedLocal], [earlierB, sharedRemote, earlierA])).toEqual([earlierA, earlierB, sharedLocal])
  })
})

describe('mergeConfig', () => {
  it('uses last-write-wins per habit, so newer remote config wins and older remote config is ignored', () => {
    const localVape = config({
      habit: 'vape',
      motivationalText: 'Local vape',
      updatedAt: '2026-07-08T09:00:00+10:00',
    })
    const localDrink = config({
      habit: 'drink',
      motivationalText: 'Local drink',
      updatedAt: '2026-07-08T09:00:00+10:00',
    })
    const newerRemoteVape = config({
      habit: 'vape',
      motivationalText: 'Remote vape',
      updatedAt: '2026-07-08T10:00:00+10:00',
    })
    const olderRemoteDrink = config({
      habit: 'drink',
      motivationalText: 'Remote drink',
      updatedAt: '2026-07-08T08:00:00+10:00',
    })

    expect(mergeConfig([localVape, localDrink], [newerRemoteVape, olderRemoteDrink])).toEqual([
      newerRemoteVape,
      localDrink,
    ])
  })
})

describe('resolveStartupState', () => {
  it('restores when any cloud events exist', () => {
    expect(resolveStartupState([event({ id: 'cloud-event' })])).toBe('restore')
  })

  it('offers setup only when the cloud event log is empty', () => {
    expect(resolveStartupState([])).toBe('offer-setup')
  })
})

describe('syncOnce', () => {
  it('clears dirty flags when an idempotent re-push reports already-inserted ids as inserted', async () => {
    const localEvent = event({ id: 'already-cloud' })
    const transport = new FakeTransport()
    transport.pushEventsResult = { ok: true, insertedIds: [localEvent.id] }

    const result = await syncOnce(appendEvent(emptyData(), localEvent), transport)

    expect(result.status).toBe('synced')
    expect(result.data.dirtyEventIds).toEqual([])
    expect(transport.pushedEvents).toEqual([[localEvent]])
  })

  it('retains dirty ids and local data when pushing dirty events fails', async () => {
    const localEvent = event({ id: 'local-dirty' })
    const data = appendEvent(emptyData(), localEvent)
    const transport = new FakeTransport()
    transport.pushEventsResult = { ok: false, insertedIds: [], error: 'offline' }

    const result = await syncOnce(data, transport)

    expect(result.status).toBe('offline')
    expect(result.data).toEqual(data)
  })

  it('merges pulled events without duplicates and advances the cursor after a successful pull', async () => {
    const localEvent = event({ id: 'local-clean', recorded_at: '2026-07-08T09:00:00+10:00' })
    const remoteEvent = event({ id: 'remote-new', recorded_at: '2026-07-08T10:00:00+10:00' })
    const data = setSyncCursor(markSynced(appendEvent(emptyData(), localEvent), [localEvent.id]), 'cursor-1')
    const transport = new FakeTransport()
    transport.pullEventsResult = {
      ok: true,
      events: [localEvent, remoteEvent],
      nextCursor: 'cursor-2',
    }

    const result = await syncOnce(data, transport)

    expect(result.status).toBe('synced')
    expect(result.data.events).toEqual([localEvent, remoteEvent])
    expect(result.data.syncCursor).toBe('cursor-2')
    expect(transport.seenCursor).toBe('cursor-1')
  })

  it('does not advance the cursor when pulling events fails after a successful push', async () => {
    const localEvent = event({ id: 'dirty-before-pull-fail' })
    const data = setSyncCursor(appendEvent(emptyData(), localEvent), 'cursor-1')
    const transport = new FakeTransport()
    transport.pushEventsResult = { ok: true, insertedIds: [localEvent.id] }
    transport.pullEventsResult = { ok: false, events: [], nextCursor: 'cursor-2', error: 'timeout' }

    const result = await syncOnce(data, transport)

    expect(result.status).toBe('offline')
    expect(result.data.dirtyEventIds).toEqual([])
    expect(result.data.syncCursor).toBe('cursor-1')
    expect(result.data.events).toEqual([localEvent])
  })

  it('pushes local config then merges pulled config with LWW semantics', async () => {
    const localConfig = config({
      habit: 'vape',
      motivationalText: 'Local',
      updatedAt: '2026-07-08T09:00:00+10:00',
    })
    const remoteConfig = config({
      habit: 'vape',
      motivationalText: 'Remote',
      updatedAt: '2026-07-08T10:00:00+10:00',
    })
    const data = upsertConfig(emptyData(), localConfig)
    const transport = new FakeTransport()
    transport.pullConfigResult = { ok: true, config: [remoteConfig] }

    const result = await syncOnce(data, transport)

    expect(result.status).toBe('synced')
    expect(transport.pushedConfig).toEqual([[localConfig]])
    expect(result.data.config).toEqual([remoteConfig])
  })
})
