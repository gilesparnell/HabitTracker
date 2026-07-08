import { HABITS, type Habit, type HabitEvent } from '../domain/events'
import type { FoldResult } from '../domain/fold'
import { highestMilestoneAtOrBelow } from '../domain/milestones'
import { appendEvent, setDeviceMilestone, upsertConfig } from '../store/local'
import type { AppData } from '../store/schema'

function eventId(): string {
  return crypto.randomUUID()
}

function eventUserId(data: AppData): string {
  return data.session?.userId ?? 'local'
}

function isRevoked(events: HabitEvent[], eventId: string, memo = new Map<string, boolean>()): boolean {
  const cached = memo.get(eventId)

  if (cached !== undefined) {
    return cached
  }

  const revoked = events.some((event) => event.type === 'revoke' && event.target_id === eventId && !isRevoked(events, event.id, memo))
  memo.set(eventId, revoked)

  return revoked
}

export function correctStartDate(data: AppData, habit: Habit, dateISO: string, nowISO: string): AppData {
  return appendEvent(data, {
    id: eventId(),
    user_id: eventUserId(data),
    habit,
    type: 'start',
    event_date: dateISO,
    recorded_at: nowISO,
  })
}

export function undoLastRelapse(data: AppData, habit: Habit, nowISO: string): AppData {
  const revokedMemo = new Map<string, boolean>()
  const relapse = data.events
    .filter((event) => event.habit === habit && event.type === 'relapse' && !isRevoked(data.events, event.id, revokedMemo))
    .sort((left, right) => {
      const recordedOrder = left.recorded_at.localeCompare(right.recorded_at)

      return recordedOrder === 0 ? left.id.localeCompare(right.id) : recordedOrder
    })
    .at(-1)

  if (relapse === undefined) {
    return data
  }

  return appendEvent(data, {
    id: eventId(),
    user_id: eventUserId(data),
    habit,
    type: 'revoke',
    event_date: null,
    target_id: relapse.id,
    recorded_at: nowISO,
  })
}

export function setMotivation(data: AppData, habit: Habit, text: string, nowISO: string): AppData {
  return upsertConfig(data, {
    habit,
    motivationalText: text,
    updatedAt: nowISO,
  })
}

export function initDeviceMilestones(data: AppData, foldResult: FoldResult): AppData {
  return HABITS.reduce(
    (next, habit) => setDeviceMilestone(next, habit, highestMilestoneAtOrBelow(foldResult[habit].currentStreakDays)),
    data,
  )
}

// Codes are digits-only; length is capped to match the input's maxlength.
// Never assume a specific code length — the shared Supabase project issues
// 8-digit codes, not the 6-digit default (see fix history for v0.3.1/0.3.2).
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 12)
}
