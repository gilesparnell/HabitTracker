import { fold } from '../domain/fold'
import { HABITS, type Habit } from '../domain/events'
import { todayLocalISO } from '../domain/calendar'
import { appendEvent, setSession, setSyncCursor } from '../store/local'
import type { AppData, StoredSession } from '../store/schema'
import { requestCode, verifyCode } from '../auth/otp'
import type { AuthClient } from '../auth/client'
import { mergeEvents, resolveStartupState, syncOnce } from '../sync/engine'
import type { SyncTransport } from '../sync/transport'
import { DEFAULT_MOTIVATION, HABIT_LABELS } from './viewmodel'
import { initDeviceMilestones } from './actions'

export interface SetupDeps {
  authClient: AuthClient
  transport: SyncTransport
}

interface ReauthDeps {
  authClient: AuthClient
}

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function setupUserId(data: AppData): string {
  return data.session?.userId ?? 'local'
}

function authEmailScreen(root: HTMLElement, title: string, body: string, onSubmit: (email: string) => void, error: string | null): void {
  root.innerHTML = `
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">Device setup</p>
      <h1 id="setup-title">${esc(title)}</h1>
      <p class="setup-copy">${esc(body)}</p>
      ${error ? `<p class="setup-error" role="alert">${esc(error)}</p>` : ''}
      <label class="field-label" for="setup-email">Email</label>
      <input class="text-input" id="setup-email" type="email" autocomplete="email" inputmode="email" />
      <button class="setup-primary" data-email-next>Send code</button>
    </section>
  `

  const input = root.querySelector<HTMLInputElement>('#setup-email')
  const button = root.querySelector<HTMLButtonElement>('[data-email-next]')
  input?.focus()
  button?.addEventListener('click', () => onSubmit(input?.value.trim() ?? ''))
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      onSubmit(input.value.trim())
    }
  })
}

function authCodeScreen(root: HTMLElement, email: string, onSubmit: (code: string) => void, onBack: () => void, error: string | null): void {
  root.innerHTML = `
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">Check your email</p>
      <h1 id="setup-title">Enter the 6-digit code</h1>
      <p class="setup-copy">Sent to ${esc(email)}.</p>
      ${error ? `<p class="setup-error" role="alert">${esc(error)}</p>` : ''}
      <label class="field-label" for="setup-code">Code</label>
      <input class="code-input" id="setup-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" />
      <div class="setup-actions">
        <button class="setup-secondary" data-code-back>Back</button>
        <button class="setup-primary" data-code-next>Verify</button>
      </div>
    </section>
  `

  const input = root.querySelector<HTMLInputElement>('#setup-code')
  input?.focus()
  root.querySelector('[data-code-back]')?.addEventListener('click', onBack)
  root.querySelector('[data-code-next]')?.addEventListener('click', () => onSubmit(input?.value.trim() ?? ''))
  input?.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6)
  })
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      onSubmit(input.value.trim())
    }
  })
}

function offlineScreen(root: HTMLElement, retry: () => void, message: string): void {
  root.innerHTML = `
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">Restore gate</p>
      <h1 id="setup-title">Can't reach the server</h1>
      <p class="setup-copy">${esc(message)}</p>
      <button class="setup-primary" data-retry>Retry</button>
    </section>
  `

  root.querySelector('[data-retry]')?.addEventListener('click', retry)
}

function startDatesScreen(root: HTMLElement, data: AppData, onSubmit: (dates: Record<Habit, string>) => void, error: string | null): void {
  const today = todayLocalISO()

  root.innerHTML = `
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">First run</p>
      <h1 id="setup-title">Set your starting dates</h1>
      <p class="setup-copy">These dates initialise this device because no cloud history exists yet.</p>
      ${error ? `<p class="setup-error" role="alert">${esc(error)}</p>` : ''}
      <div class="setup-date-list">
        ${HABITS.map(
          (habit) => `
            <label class="settings-row setup-date-row">
              <span>
                <strong>${esc(HABIT_LABELS[habit])}</strong>
                <small>${esc(DEFAULT_MOTIVATION[habit])}</small>
              </span>
              <input type="date" data-start-date="${habit}" value="${today}" max="${today}" />
            </label>
          `,
        ).join('')}
      </div>
      <button class="setup-primary" data-setup-finish>Start tracking</button>
    </section>
  `

  root.querySelector('[data-setup-finish]')?.addEventListener('click', () => {
    const dates = Object.fromEntries(
      HABITS.map((habit) => {
        const input = root.querySelector<HTMLInputElement>(`[data-start-date="${habit}"]`)
        return [habit, input?.value || today]
      }),
    ) as Record<Habit, string>

    onSubmit(dates)
  })
}

function appendInitialStarts(data: AppData, dates: Record<Habit, string>): AppData {
  return HABITS.reduce(
    (next, habit) =>
      appendEvent(next, {
        id: crypto.randomUUID(),
        user_id: setupUserId(next),
        habit,
        type: 'start',
        event_date: dates[habit],
        recorded_at: new Date().toISOString(),
      }),
    data,
  )
}

async function pullStartup(root: HTMLElement, data: AppData, deps: SetupDeps, onComplete: (data: AppData) => void): Promise<void> {
  root.innerHTML = `
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">Restore gate</p>
      <h1 id="setup-title">Checking for your history</h1>
      <p class="setup-copy">A fresh device restores existing streaks before setup is offered.</p>
    </section>
  `

  const result = await deps.transport.pullEvents(null)

  if (!result.ok) {
    offlineScreen(root, () => {
      void pullStartup(root, data, deps, onComplete)
    }, result.error ?? 'The app needs one successful check before it can decide whether to restore or set up.')
    return
  }

  if (resolveStartupState(result.events) === 'restore') {
    const restored = setSyncCursor(
      initDeviceMilestones(
        {
          ...data,
          events: mergeEvents(data.events, result.events),
        },
        fold(mergeEvents(data.events, result.events), todayLocalISO()),
      ),
      result.nextCursor,
    )
    onComplete(restored)
    return
  }

  startDatesScreen(root, data, async (dates) => {
    const seeded = appendInitialStarts(data, dates)
    const synced = await syncOnce(seeded, deps.transport)
    onComplete(synced.data)
  }, null)
}

export function runFirstRun(root: HTMLElement, data: AppData, deps: SetupDeps, onComplete: (data: AppData) => void): void {
  const showEmail = (error: string | null = null): void => {
    authEmailScreen(root, 'Sign in once on this device', 'Your streaks work offline, then sync to your private backup.', async (email) => {
      const result = await requestCode(deps.authClient, email)

      if (!result.ok) {
        showEmail(result.error)
        return
      }

      showCode(email)
    }, error)
  }

  const showCode = (email: string, error: string | null = null): void => {
    authCodeScreen(root, email, async (code) => {
      const result = await verifyCode(deps.authClient, email, code)

      if (!result.ok) {
        showCode(email, result.error)
        return
      }

      const withSession = setSession(data, result.session)
      await pullStartup(root, withSession, deps, onComplete)
    }, () => showEmail(), error)
  }

  showEmail()
}

export function runReauth(root: HTMLElement, deps: ReauthDeps, onSession: (session: StoredSession) => void): void {
  const showEmail = (error: string | null = null): void => {
    authEmailScreen(root, 'Sign in again', 'Refresh the device session without changing your local streak data.', async (email) => {
      const result = await requestCode(deps.authClient, email)

      if (!result.ok) {
        showEmail(result.error)
        return
      }

      showCode(email)
    }, error)
  }

  const showCode = (email: string, error: string | null = null): void => {
    authCodeScreen(root, email, async (code) => {
      const result = await verifyCode(deps.authClient, email, code)

      if (!result.ok) {
        showCode(email, result.error)
        return
      }

      onSession(result.session)
    }, () => showEmail(), error)
  }

  showEmail()
}
