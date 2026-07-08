import './styles/main.css'
import { todayLocalISO } from './domain/calendar'
import type { Habit } from './domain/events'
import { appendEvent, loadData, saveData, type StorageLike } from './store/local'
import type { AppData } from './store/schema'
import { flashAck, renderApp, type Handlers } from './ui/render'
import { buildScreenModel } from './ui/viewmodel'

const root = document.querySelector<HTMLDivElement>('#app')
const storage: StorageLike = window.localStorage

if (root !== null) {
  boot(root, storage)
}

function boot(appRoot: HTMLElement, store: StorageLike): void {
  const loaded = loadData(store)
  let data: AppData = loaded.data
  let warning: string | null = loaded.warning

  const update = (next: AppData): void => {
    data = next
    if (!saveData(store, data)) {
      warning = 'Could not save to this device. Your entry is kept for this session — export a backup from settings.'
    }
    rerender()
  }

  const handlers: Handlers = {
    onAnswerClean(habit: Habit, kind: 'daily' | 'catchup'): void {
      update(
        appendEvent(data, {
          id: crypto.randomUUID(),
          user_id: data.session?.userId ?? 'local',
          habit,
          type: 'checkin',
          kind,
          event_date: todayLocalISO(),
          recorded_at: new Date().toISOString(),
        }),
      )
      flashAck(appRoot, habit)
    },

    onRelapseConfirmed(habit: Habit, dateISO: string): void {
      update(
        appendEvent(data, {
          id: crypto.randomUUID(),
          user_id: data.session?.userId ?? 'local',
          habit,
          type: 'relapse',
          event_date: dateISO,
          recorded_at: new Date().toISOString(),
        }),
      )
    },

    onOpenSettings(): void {
      // Implemented by the settings sheet (device-setup / settings unit).
    },
  }

  const rerender = (): void => {
    renderApp(appRoot, buildScreenModel(data), handlers, warning)
  }

  rerender()
}
