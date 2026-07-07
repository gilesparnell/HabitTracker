export type Habit = 'vape' | 'drink'

export const HABITS: readonly Habit[] = ['vape', 'drink']

export type EventType = 'start' | 'checkin' | 'relapse' | 'revoke'

export type CheckinKind = 'daily' | 'catchup'

export interface HabitEvent {
  id: string
  user_id: string
  habit: Habit
  type: EventType
  event_date: string | null
  kind?: CheckinKind
  target_id?: string
  recorded_at: string
  created_at?: string
}
