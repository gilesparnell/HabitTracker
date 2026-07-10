import './styles/main.css'
import { createClient } from '@supabase/supabase-js'
import { todayLocalISO } from './domain/calendar'
import type { Habit } from './domain/events'
import { appendEvent, loadData, saveData, setDeviceMilestone, setSession, type StorageLike } from './store/local'
import type { AppData } from './store/schema'
import { restoreSession } from './auth/otp'
import { syncOnce } from './sync/engine'
import { createSupabaseTransport, type SyncTransport } from './sync/transport'
import { celebrationFor, showMadeItThroughNote, showMilestoneCelebration } from './ui/celebrate'
import { flashAck, renderApp, type Handlers } from './ui/render'
import { openSettingsSheet } from './ui/settings'
import { runFirstRun, runReauth, type SetupDeps } from './ui/setup'
import { buildScreenModel } from './ui/viewmodel'
import { registerServiceWorker } from './lib/serviceWorker'
import { getLatestWhatsNew } from './lib/changelog-parser'
import { showUpdateNotification, hideUpdateNotification } from './ui/update-notification'
import { renderChangelogPage } from './pages/changelog'
import { createPullToRefreshHandler } from './ui/pull-to-refresh'
import CHANGELOG_TEXT from '../CHANGELOG.md?raw'

const root = document.querySelector<HTMLDivElement>('#app')
const storage: StorageLike = window.localStorage

// Create a separate container for persistent notifications (outside app root)
const notificationContainer = document.createElement('div')
notificationContainer.id = 'notifications'
document.body.appendChild(notificationContainer)

if (root !== null) {
  boot(root, storage)
}

// Register service worker and listen for updates
if ('serviceWorker' in navigator && (import.meta.env as { readonly PROD?: boolean }).PROD) {
  window.addEventListener('load', () => {
    const latestVersion = getLatestWhatsNew(CHANGELOG_TEXT)
    registerServiceWorker({
      onUpdateAvailable: () => {
        if (latestVersion) {
          showUpdateNotification(notificationContainer, latestVersion, () => {
            window.location.reload()
          })
        }
      },
    })
  })
}

function boot(appRoot: HTMLElement, store: StorageLike): void {
  const loaded = loadData(store)
  let data: AppData = loaded.data
  let warning: string | null = loaded.warning
  let reauthRequired = false
  let syncRun = 0
  // Cloud is optional at boot: a missing/invalid configuration must never block
  // local check-ins. Everything degrades to the same offline paths used when
  // the network is down.
  let supabase: ReturnType<typeof createClient> | null = null
  try {
    supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    })
  } catch {
    supabase = null
  }

  const offlineError = (): Error => new Error('Cloud backup is not configured on this build.')
  const transport: SyncTransport = supabase
    ? createSupabaseTransport(supabase as unknown as Parameters<typeof createSupabaseTransport>[0])
    : {
        pushEvents: () => Promise.resolve({ ok: false, insertedIds: [], error: offlineError().message }),
        pullEvents: () => Promise.resolve({ ok: false, events: [], nextCursor: null, error: offlineError().message }),
        pushConfig: () => Promise.resolve({ ok: false, error: offlineError().message }),
        pullConfig: () => Promise.resolve({ ok: false, config: [], error: offlineError().message }),
      }
  const authClient: SetupDeps['authClient'] = supabase
    ? (supabase.auth as SetupDeps['authClient'])
    : {
        signInWithOtp: () => Promise.resolve({ data: {}, error: offlineError() }),
        verifyOtp: () => Promise.resolve({ data: { session: null }, error: offlineError() }),
        setSession: () => Promise.resolve({ data: { session: null }, error: offlineError() }),
      }
  const deps: SetupDeps = {
    authClient,
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
      const now = new Date()
      const todayISO = todayLocalISO(now)
      const next = appendEvent(data, {
        id: crypto.randomUUID(),
        user_id: data.session?.userId ?? 'local',
        habit,
        type: 'checkin',
        kind,
        event_date: todayISO,
        recorded_at: now.toISOString(),
      })
      const celebration = celebrationFor(next, habit, todayISO, now)

      if (celebration.milestone !== null) {
        update(setDeviceMilestone(next, habit, celebration.milestone))
        showMilestoneCelebration(appRoot, celebration.milestone)
        return
      }

      update(next)

      if (celebration.madeItThrough) {
        showMadeItThroughNote(appRoot)
        return
      }

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
          runReauth(appRoot, { authClient }, (session) => {
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

  // Handle changelog navigation
  appRoot.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a[href*="/changelog"]')
    if (link) {
      event.preventDefault()
      const href = link.getAttribute('href') || '/changelog'
      const anchor = href.split('#')[1]
      showChangelogPage(appRoot, anchor)
    }
  })

  // Setup pull-to-refresh on the app element
  const pullToRefresh = createPullToRefreshHandler(appRoot, () => {
    window.location.reload()
  })

  if (data.session !== null) {
    void restoreSession(authClient, data.session).then((result) => {
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

function showChangelogPage(appRoot: HTMLElement, anchor?: string): void {
  const closeButton = appRoot.querySelector('[data-changelog-close]')
  if (closeButton) {
    closeButton.remove()
  }

  const changelogContainer = document.createElement('div')
  changelogContainer.setAttribute('data-changelog-close', '')
  changelogContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9000;
    overflow-y: auto;
    padding: 20px;
  `

  const closeOnClick = (event: Event): void => {
    if (event.target === changelogContainer) {
      changelogContainer.remove()
      changelogContainer.removeEventListener('click', closeOnClick)
    }
  }

  changelogContainer.addEventListener('click', closeOnClick)
  appRoot.appendChild(changelogContainer)

  renderChangelogPage(changelogContainer, anchor)

  // Add close button
  const inner = changelogContainer.querySelector('.changelog-container') as HTMLElement
  if (inner) {
    const closeBtn = inner.querySelector('a[href="/"]') as HTMLElement
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault()
        changelogContainer.remove()
      })
    }
  }
}
