import './styles/main.css'
import { createClient } from '@supabase/supabase-js'
import { todayLocalISO } from './domain/calendar'
import type { Habit } from './domain/events'
import { appendEvent, loadData, saveData, setSession, type StorageLike } from './store/local'
import type { AppData } from './store/schema'
import { restoreSession } from './auth/otp'
import { syncOnce } from './sync/engine'
import { createSupabaseTransport, type SyncTransport } from './sync/transport'
import { flashAck, renderApp, type Handlers } from './ui/render'
import { openSettingsSheet } from './ui/settings'
import { runFirstRun, runReauth, type SetupDeps } from './ui/setup'
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
  let reauthRequired = false
  let syncRun = 0
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  })
  const transport: SyncTransport = createSupabaseTransport(supabase as unknown as Parameters<typeof createSupabaseTransport>[0])
  const deps: SetupDeps = {
    authClient: supabase.auth,
    transport,
  }

  const update = (next: AppData): void => {
    data = next
    if (!saveData(store, data)) {
      warning = 'Could not save to this device. Your entry is kept for this session — export a backup from settings.'
    }
    rerender()
    fireSync()
  }

  const replaceData = (next: AppData): void => {
    data = next
    if (!saveData(store, data)) {
      warning = 'Could not save to this device. Your entry is kept for this session — export a backup from settings.'
    }
    rerender()
  }

  const fireSync = (): void => {
    if (data.session === null) {
      return
    }

    const run = ++syncRun
    const snapshot = data

    void syncOnce(snapshot, transport).then((result) => {
      if (run !== syncRun) {
        return
      }

      if (result.status === 'synced') {
        replaceData(result.data)
      }
    })
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
      openSettingsSheet(appRoot, data, {
        onData: update,
        onImport: update,
        onReauth(): void {
          runReauth(appRoot, { authClient: supabase.auth }, (session) => {
            reauthRequired = false
            update(setSession(data, session))
          })
        },
      })
    },
  }

  const rerender = (): void => {
    const authWarning = reauthRequired ? 'Sign in again from settings to resume cloud backup. Check-ins still work.' : null
    renderApp(appRoot, buildScreenModel(data), handlers, warning ?? authWarning)

    if (data.events.length === 0) {
      const setupRoot = appRoot.querySelector<HTMLElement>('[data-setup-root]')

      if (setupRoot !== null) {
        runFirstRun(setupRoot, data, deps, update)
      }
    }
  }

  rerender()

  if (data.session !== null) {
    void restoreSession(supabase.auth, data.session).then((result) => {
      if (result.ok) {
        update(setSession(data, result.session))
        return
      }

      reauthRequired = true
      rerender()
    })
  }

  window.addEventListener('online', () => fireSync())
}
