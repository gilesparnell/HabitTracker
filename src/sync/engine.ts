import type { HabitEvent } from '../domain/events'
import { markSynced, setSyncCursor, upsertConfig } from '../store/local'
import { emptyData, type AppData, type HabitConfig } from '../store/schema'
import type { SyncTransport } from './transport'

export type SyncStatus = 'synced' | 'offline' | 'error'

function byRecordedAtThenId(left: HabitEvent, right: HabitEvent): number {
  const recordedOrder = left.recorded_at.localeCompare(right.recorded_at)

  if (recordedOrder !== 0) {
    return recordedOrder
  }

  return left.id.localeCompare(right.id)
}

function failureStatus(error: string | undefined): SyncStatus {
  if (error === undefined) {
    return 'error'
  }

  return /offline|network|timeout|fetch/i.test(error) ? 'offline' : 'error'
}

export function mergeEvents(local: HabitEvent[], remote: HabitEvent[]): HabitEvent[] {
  const byId = new Map<string, HabitEvent>()

  for (const item of [...local, ...remote]) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    }
  }

  return [...byId.values()].sort(byRecordedAtThenId)
}

export function mergeConfig(local: HabitConfig[], remote: HabitConfig[]): HabitConfig[] {
  let data: AppData = { ...emptyData(), config: local }

  for (const config of remote) {
    data = upsertConfig(data, config)
  }

  return data.config
}

export async function syncOnce(
  data: AppData,
  transport: SyncTransport,
): Promise<{ data: AppData; status: SyncStatus }> {
  let nextData = data
  const dirtyIds = new Set(nextData.dirtyEventIds)
  const dirtyEvents = nextData.events.filter((event) => dirtyIds.has(event.id))

  if (dirtyEvents.length > 0) {
    const pushEventsResult = await transport.pushEvents(dirtyEvents)

    if (!pushEventsResult.ok) {
      return { data: nextData, status: failureStatus(pushEventsResult.error) }
    }

    nextData = markSynced(nextData, pushEventsResult.insertedIds)
  }

  const pullEventsResult = await transport.pullEvents(nextData.syncCursor)

  if (!pullEventsResult.ok) {
    return { data: nextData, status: failureStatus(pullEventsResult.error) }
  }

  nextData = setSyncCursor(
    {
      ...nextData,
      events: mergeEvents(nextData.events, pullEventsResult.events),
    },
    pullEventsResult.nextCursor,
  )

  const pushConfigResult = await transport.pushConfig(nextData.config)

  if (!pushConfigResult.ok) {
    return { data: nextData, status: failureStatus(pushConfigResult.error) }
  }

  const pullConfigResult = await transport.pullConfig()

  if (!pullConfigResult.ok) {
    return { data: nextData, status: failureStatus(pullConfigResult.error) }
  }

  return {
    data: {
      ...nextData,
      config: mergeConfig(nextData.config, pullConfigResult.config),
    },
    status: 'synced',
  }
}

export function resolveStartupState(cloudEvents: HabitEvent[]): 'restore' | 'offer-setup' {
  return cloudEvents.length > 0 ? 'restore' : 'offer-setup'
}
