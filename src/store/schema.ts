import { HABITS, type Habit, type HabitEvent } from '../domain/events'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'ht:appdata'

export interface HabitConfig {
  habit: Habit
  motivationalText: string
  updatedAt: string
}

export interface DeviceState {
  lastCelebratedMilestone: Record<Habit, number>
}

export interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  userId: string
  email: string | null
}

export interface AppData {
  schemaVersion: number
  events: HabitEvent[]
  config: HabitConfig[]
  device: DeviceState
  session: StoredSession | null
  syncCursor: string | null
  dirtyEventIds: string[]
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    events: [],
    config: [],
    device: {
      lastCelebratedMilestone: Object.fromEntries(HABITS.map((habit) => [habit, 0])) as Record<Habit, number>,
    },
    session: null,
    syncCursor: null,
    dirtyEventIds: [],
  }
}
