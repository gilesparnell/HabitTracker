import { HABITS, type Habit, type HabitEvent } from './events'
import { clampFutureISO, daysBetween, localDateISO } from './calendar'

export interface HabitState {
  habit: Habit
  streakStartDate: string | null
  currentStreakDays: number
  longestStreakDays: number
  totalCleanDays: number
  lastInteractionDate: string | null
}

export type FoldResult = Record<Habit, HabitState>

export function foldHabit(events: HabitEvent[], habit: Habit, todayISO: string): HabitState {
  const habitEvents = events.filter((event) => event.habit === habit)
  const activeEvents = activeHabitEvents(habitEvents)
  const lastInteractionDate = lastActiveInteractionDate(activeEvents, todayISO)
  const starts = activeEvents.filter((event) => event.type === 'start')
  const effectiveStart = starts.slice().sort(compareRecordedAt).at(-1)
  const relapses = activeEvents.filter((event) => event.type === 'relapse')
  const anchors = [effectiveStart, ...relapses]
    .filter((event): event is HabitEvent => event !== undefined && event.event_date !== null)
    .map((event) => ({
      date: clampFutureISO(event.event_date as string, todayISO),
      recordedAt: event.recorded_at,
    }))
    .sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date)

      return dateComparison === 0 ? compareRecordedAtValue(a.recordedAt, b.recordedAt) : dateComparison
    })

  if (anchors.length === 0) {
    return {
      habit,
      streakStartDate: null,
      currentStreakDays: 0,
      longestStreakDays: 0,
      totalCleanDays: 0,
      lastInteractionDate,
    }
  }

  const streakStartDate = anchors.at(-1)?.date ?? null
  const currentStreakDays = streakStartDate === null ? 0 : Math.max(0, daysBetween(streakStartDate, todayISO))
  const endedLengths = anchors
    .slice(0, -1)
    .map((anchor, index) => daysBetween(anchor.date, anchors[index + 1].date))
  const longestStreakDays = Math.max(currentStreakDays, ...endedLengths)
  const totalCleanDays = currentStreakDays + endedLengths.reduce((total, days) => total + days, 0)

  return {
    habit,
    streakStartDate,
    currentStreakDays,
    longestStreakDays,
    totalCleanDays,
    lastInteractionDate,
  }
}

export function fold(events: HabitEvent[], todayISO: string): FoldResult {
  return Object.fromEntries(HABITS.map((habit) => [habit, foldHabit(events, habit, todayISO)])) as FoldResult
}

export type CheckinStatus = 'none' | 'standard' | 'catchup'

export function checkinStatus(
  state: HabitState,
  todayISO: string,
  now?: Date,
  configuredTime?: string,
): CheckinStatus {
  if (state.lastInteractionDate === null) {
    return 'none'
  }

  const lastInteractionDate = clampFutureISO(state.lastInteractionDate, todayISO)

  if (lastInteractionDate === todayISO) {
    return 'none'
  }

  // Check if we've passed the configured check-in time today
  const checkInHour = parseTimeOrDefault(configuredTime)
  const currentHour = (now ?? new Date()).getHours()

  if (currentHour < checkInHour) {
    return 'none' // Wait until configured time
  }

  // We've passed the time threshold and need a check-in
  return daysBetween(lastInteractionDate, todayISO) === 1 ? 'standard' : 'catchup'
}

function parseTimeOrDefault(timeString?: string): number {
  if (!timeString) return 7 // default 07:00

  const match = timeString.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 7 // invalid format, use default

  const hour = parseInt(match[1], 10)
  if (hour < 0 || hour > 23) return 7 // out of range, use default

  return hour
}

function activeHabitEvents(events: HabitEvent[]): HabitEvent[] {
  const revokedMemo = new Map<string, boolean>()

  function isRevoked(eventId: string): boolean {
    const memoized = revokedMemo.get(eventId)

    if (memoized !== undefined) {
      return memoized
    }

    const revoked = events.some((event) => event.type === 'revoke' && event.target_id === eventId && !isRevoked(event.id))
    revokedMemo.set(eventId, revoked)

    return revoked
  }

  return events.filter((event) => !isRevoked(event.id))
}

function lastActiveInteractionDate(events: HabitEvent[], todayISO: string): string | null {
  const latest = events.slice().sort(compareRecordedAt).at(-1)

  if (latest === undefined) {
    return null
  }

  return clampFutureISO(localDateISO(new Date(latest.recorded_at)), todayISO)
}

function compareRecordedAt(a: HabitEvent, b: HabitEvent): number {
  return compareRecordedAtValue(a.recorded_at, b.recorded_at)
}

function compareRecordedAtValue(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b)
}
