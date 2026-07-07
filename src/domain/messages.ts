import type { Habit } from './events'
import type { CheckinStatus } from './fold'
import { isFriSatEvening, isWeekendDateISO } from './calendar'

export const MADE_IT_THROUGH_TEXT = 'You made it through a hard window.'
export const FRI_SAT_EVENING_TEXT = 'This is one of the harder windows. Keep it simple tonight.'

export type SupportMessage =
  | { kind: 'made-it-through'; text: string }
  | { kind: 'fri-sat-evening'; text: string }
  | null

export function supportMessage(now: Date, justCheckedInCleanOnISO: string | null): SupportMessage {
  if (justCheckedInCleanOnISO !== null && isWeekendDateISO(justCheckedInCleanOnISO)) {
    return { kind: 'made-it-through', text: MADE_IT_THROUGH_TEXT }
  }

  if (isFriSatEvening(now)) {
    return { kind: 'fri-sat-evening', text: FRI_SAT_EVENING_TEXT }
  }

  return null
}

export function promptText(habit: Habit, status: CheckinStatus): string {
  if (status === 'none') {
    return ''
  }

  if (status === 'standard') {
    return `Since your last check-in, did you ${habit}?`
  }

  return `Since your last check-in, did you stay clean the whole time from ${habit}?`
}

export function milestoneMessage(days: number): string {
  return `${days} days. That is steady work.`
}
