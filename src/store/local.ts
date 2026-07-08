import type { HabitEvent } from '../domain/events'
import { HABITS } from '../domain/events'
import { emptyData, SCHEMA_VERSION, STORAGE_KEY, type AppData, type HabitConfig, type StoredSession } from './schema'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResult {
  data: AppData
  warning: string | null
}

type RecordLike = Record<string, unknown>

const HABIT_SET = new Set<string>(HABITS)
const EVENT_TYPES = new Set<string>(['start', 'checkin', 'relapse', 'revoke'])
const CHECKIN_KINDS = new Set<string>(['daily', 'catchup'])

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHabit(value: unknown): value is HabitEvent['habit'] {
  return typeof value === 'string' && HABIT_SET.has(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isSession(value: unknown): value is StoredSession | null {
  if (value === null) {
    return true
  }

  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    (typeof value.expiresAt === 'number' || value.expiresAt === null) &&
    typeof value.userId === 'string' &&
    isStringOrNull(value.email)
  )
}

function isHabitEvent(value: unknown): value is HabitEvent {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    isHabit(value.habit) &&
    typeof value.type === 'string' &&
    EVENT_TYPES.has(value.type) &&
    isStringOrNull(value.event_date) &&
    typeof value.recorded_at === 'string' &&
    (value.kind === undefined || (typeof value.kind === 'string' && CHECKIN_KINDS.has(value.kind))) &&
    (value.target_id === undefined || typeof value.target_id === 'string') &&
    (value.created_at === undefined || typeof value.created_at === 'string')
  )
}

function isHabitConfig(value: unknown): value is HabitConfig {
  if (!isRecord(value)) {
    return false
  }

  return isHabit(value.habit) && typeof value.motivationalText === 'string' && typeof value.updatedAt === 'string'
}

function isDeviceState(value: unknown): value is AppData['device'] {
  if (!isRecord(value) || !isRecord(value.lastCelebratedMilestone)) {
    return false
  }

  const milestones = value.lastCelebratedMilestone

  return HABITS.every((habit) => typeof milestones[habit] === 'number')
}

function parseAppData(value: unknown): AppData | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.schemaVersion !== SCHEMA_VERSION) {
    return null
  }

  if (
    !Array.isArray(value.events) ||
    !Array.isArray(value.config) ||
    !isDeviceState(value.device) ||
    !isSession(value.session) ||
    !isStringOrNull(value.syncCursor) ||
    !Array.isArray(value.dirtyEventIds)
  ) {
    return null
  }

  if (
    !value.events.every(isHabitEvent) ||
    !value.config.every(isHabitConfig) ||
    !value.dirtyEventIds.every((id) => typeof id === 'string')
  ) {
    return null
  }

  return {
    schemaVersion: value.schemaVersion,
    events: value.events,
    config: value.config,
    device: value.device,
    session: value.session,
    syncCursor: value.syncCursor,
    dirtyEventIds: value.dirtyEventIds,
  }
}

function parseStoredJSON(json: string, source: string): LoadResult {
  try {
    const parsed = JSON.parse(json) as unknown
    const data = parseAppData(parsed)

    if (data === null) {
      return { data: emptyData(), warning: `${source} is not valid HabitTracker data.` }
    }

    return { data, warning: null }
  } catch {
    return { data: emptyData(), warning: `${source} could not be parsed.` }
  }
}

export function loadData(storage: StorageLike): LoadResult {
  const stored = storage.getItem(STORAGE_KEY)

  if (stored === null) {
    return { data: emptyData(), warning: null }
  }

  return parseStoredJSON(stored, 'Stored data')
}

export function saveData(storage: StorageLike, data: AppData): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function appendEvent(data: AppData, event: HabitEvent): AppData {
  const dirtyEventIds = data.dirtyEventIds.includes(event.id) ? data.dirtyEventIds : [...data.dirtyEventIds, event.id]

  return {
    ...data,
    events: [...data.events, event],
    dirtyEventIds,
  }
}

export function markSynced(data: AppData, ids: string[]): AppData {
  const synced = new Set(ids)

  return {
    ...data,
    dirtyEventIds: data.dirtyEventIds.filter((id) => !synced.has(id)),
  }
}

export function upsertConfig(data: AppData, config: HabitConfig): AppData {
  const existingIndex = data.config.findIndex((item) => item.habit === config.habit)

  if (existingIndex === -1) {
    return {
      ...data,
      config: [...data.config, config],
    }
  }

  const existing = data.config[existingIndex]

  if (config.updatedAt < existing.updatedAt) {
    return {
      ...data,
      config: [...data.config],
    }
  }

  return {
    ...data,
    config: data.config.map((item, index) => (index === existingIndex ? config : item)),
  }
}

export function setDeviceMilestone(data: AppData, habit: 'vape' | 'drink', value: number): AppData {
  return {
    ...data,
    device: {
      ...data.device,
      lastCelebratedMilestone: {
        ...data.device.lastCelebratedMilestone,
        [habit]: value,
      },
    },
  }
}

export function setSession(data: AppData, session: AppData['session']): AppData {
  return {
    ...data,
    session,
  }
}

export function setSyncCursor(data: AppData, cursor: string | null): AppData {
  return {
    ...data,
    syncCursor: cursor,
  }
}

export function exportJSON(data: AppData): string {
  return JSON.stringify(data)
}

export function importJSON(json: string): LoadResult {
  return parseStoredJSON(json, 'Imported data')
}
