import { todayLocalISO } from '../domain/calendar'
import { HABITS, type Habit } from '../domain/events'
import { checkinStatus, fold } from '../domain/fold'
import { promptText, supportMessage } from '../domain/messages'
import type { AppData } from '../store/schema'

export interface CounterVM {
  habit: Habit
  label: string
  days: number
  motivationalText: string
  best: number
  totalClean: number
}

export interface PromptVM {
  habit: Habit
  status: 'standard' | 'catchup'
  question: string
  windowNote: string
}

export interface ScreenModel {
  needsSetup: boolean
  counters: CounterVM[]
  prompt: PromptVM | null
  supportLine: string | null
}

export const HABIT_LABELS: Record<Habit, string> = {
  vape: 'Nicotine-free',
  drink: 'Alcohol-free',
}

export const DEFAULT_MOTIVATION: Record<Habit, string> = {
  vape: 'Every clear breath is your lungs rebuilding. You never needed it.',
  drink: 'Clear mornings, real sleep, and you — fully present for what matters.',
}

const WINDOW_NOTES: Record<'standard' | 'catchup', string> = {
  standard: 'Covering since your last check-in',
  catchup: 'One answer covers the days since your last check-in',
}

export function buildScreenModel(data: AppData, now?: Date): ScreenModel {
  const todayISO = todayLocalISO(now)
  const folded = fold(data.events, todayISO)
  const needsSetup = data.events.length === 0

  const counters: CounterVM[] = HABITS.map((habit) => {
    const state = folded[habit]
    const configured = data.config.find((item) => item.habit === habit)

    return {
      habit,
      label: HABIT_LABELS[habit],
      days: state.currentStreakDays,
      motivationalText: configured?.motivationalText.trim() ? configured.motivationalText : DEFAULT_MOTIVATION[habit],
      best: state.longestStreakDays,
      totalClean: state.totalCleanDays,
    }
  })

  let prompt: PromptVM | null = null

  if (!needsSetup) {
    for (const habit of HABITS) {
      const configured = data.config.find((item) => item.habit === habit)
      const checkInTime = configured?.checkInTime
      const status = checkinStatus(folded[habit], todayISO, now, checkInTime)

      if (status !== 'none') {
        prompt = {
          habit,
          status,
          question: promptText(habit, status),
          windowNote: WINDOW_NOTES[status],
        }
        break
      }
    }
  }

  return {
    needsSetup,
    counters,
    prompt,
    supportLine: supportMessage(now ?? new Date(), null)?.text ?? null,
  }
}
