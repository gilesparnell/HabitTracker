import { foldHabit } from '../domain/fold'
import { HABITS, type Habit, type HabitEvent } from '../domain/events'
import { todayLocalISO } from '../domain/calendar'
import { exportJSON, importJSON } from '../store/local'
import type { AppData } from '../store/schema'
import { correctStartDate, setMotivation, undoLastRelapse } from './actions'
import { HABIT_LABELS } from './viewmodel'
import { versionLabel } from '../version'

export interface SettingsCallbacks {
  onData(next: AppData): void
  onImport(next: AppData): void
  onReauth(): void
}

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function activeRelapses(events: HabitEvent[], habit: Habit): HabitEvent[] {
  const revokedMemo = new Map<string, boolean>()

  function isRevoked(eventId: string): boolean {
    const cached = revokedMemo.get(eventId)

    if (cached !== undefined) {
      return cached
    }

    const revoked = events.some((event) => event.type === 'revoke' && event.target_id === eventId && !isRevoked(event.id))
    revokedMemo.set(eventId, revoked)

    return revoked
  }

  return events
    .filter((event) => event.habit === habit && event.type === 'relapse' && !isRevoked(event.id))
    .sort((left, right) => {
      const recordedOrder = left.recorded_at.localeCompare(right.recorded_at)

      return recordedOrder === 0 ? left.id.localeCompare(right.id) : recordedOrder
    })
}

function configText(data: AppData, habit: Habit): string {
  return data.config.find((item) => item.habit === habit)?.motivationalText ?? ''
}

function habitSettings(data: AppData, habit: Habit): string {
  const today = todayLocalISO()
  const state = foldHabit(data.events, habit, today)
  const relapse = activeRelapses(data.events, habit).at(-1)

  return `
    <section class="settings-group" data-settings-habit="${habit}">
      <div class="settings-group-head">
        <h2>${esc(HABIT_LABELS[habit])}</h2>
        <span>${state.currentStreakDays} days</span>
      </div>
      <label class="field-label" for="motivation-${habit}">Motivational text</label>
      <textarea id="motivation-${habit}" class="settings-textarea" rows="3" data-motivation="${habit}">${esc(configText(data, habit))}</textarea>
      <button class="settings-action" data-save-motivation="${habit}">Save motivation</button>
      <label class="settings-row">
        <span>
          <strong>Correct start date</strong>
          <small>Appends a new start event. History stays intact.</small>
        </span>
        <input type="date" value="${esc(state.streakStartDate ?? today)}" max="${today}" data-start-correct="${habit}" />
      </label>
      <button class="settings-action" data-correct-start="${habit}">Save start date</button>
      <button class="settings-action danger" data-undo-relapse="${habit}" ${relapse === undefined ? 'disabled' : ''}>
        Undo last relapse
      </button>
    </section>
  `
}

function showMessage(overlay: HTMLElement, message: string): void {
  const slot = overlay.querySelector<HTMLElement>('[data-settings-message]')

  if (slot !== null) {
    slot.textContent = message
    slot.hidden = false
  }
}

function downloadBackup(data: AppData): void {
  const blob = new Blob([exportJSON(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'habit-tracker-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function openSettingsSheet(root: HTMLElement, data: AppData, callbacks: SettingsCallbacks): void {
  root.querySelector('[data-settings]')?.remove()

  root.insertAdjacentHTML(
    'beforeend',
    `
      <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-settings>
        <div class="sheet settings-sheet">
          <div class="settings-title-row">
            <div>
              <p class="kicker">Settings</p>
              <h1 id="settings-title">Tracker settings</h1>
            </div>
            <button class="icon-close" aria-label="Close settings" data-settings-close>&times;</button>
          </div>
          <p class="settings-message" data-settings-message hidden></p>
          <div class="settings-scroll">
            ${HABITS.map((habit) => habitSettings(data, habit)).join('')}
            <section class="settings-group">
              <div class="settings-group-head">
                <h2>Backup</h2>
              </div>
              <button class="settings-action" data-export>Export backup</button>
              <label class="settings-action file-action">
                Import backup
                <input type="file" accept="application/json" data-import hidden />
              </label>
            </section>
            <section class="settings-group">
              <div class="settings-group-head">
                <h2>Account</h2>
              </div>
              <button class="settings-row button-row" data-reauth>
                <span>
                  <strong>${data.session?.email ? esc(data.session.email) : 'Sign in'}</strong>
                  <small>${data.session === null ? 'Connect this device to backup sync.' : 'Refresh this device session.'}</small>
                </span>
              </button>
            </section>
          </div>
          <p class="settings-version">${esc(versionLabel())}</p>
        </div>
      </div>
    `,
  )

  const overlay = root.querySelector<HTMLElement>('[data-settings]')

  if (overlay === null) {
    return
  }

  overlay.querySelector<HTMLElement>('.settings-sheet')?.focus()
  overlay.querySelector('[data-settings-close]')?.addEventListener('click', () => overlay.remove())

  for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-save-motivation]')) {
    button.addEventListener('click', () => {
      const habit = button.dataset.saveMotivation as Habit
      const textarea = overlay.querySelector<HTMLTextAreaElement>(`[data-motivation="${habit}"]`)
      callbacks.onData(setMotivation(data, habit, textarea?.value ?? '', new Date().toISOString()))
      overlay.remove()
    })
  }

  for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-correct-start]')) {
    button.addEventListener('click', () => {
      const habit = button.dataset.correctStart as Habit
      const input = overlay.querySelector<HTMLInputElement>(`[data-start-correct="${habit}"]`)
      callbacks.onData(correctStartDate(data, habit, input?.value || todayLocalISO(), new Date().toISOString()))
      overlay.remove()
    })
  }

  for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-undo-relapse]')) {
    button.addEventListener('click', () => {
      const habit = button.dataset.undoRelapse as Habit

      if (!window.confirm(`Undo the latest ${habit === 'vape' ? 'nicotine' : 'alcohol'} relapse?`)) {
        return
      }

      callbacks.onData(undoLastRelapse(data, habit, new Date().toISOString()))
      overlay.remove()
    })
  }

  overlay.querySelector('[data-export]')?.addEventListener('click', () => downloadBackup(data))
  overlay.querySelector('[data-reauth]')?.addEventListener('click', () => {
    overlay.remove()
    callbacks.onReauth()
  })

  overlay.querySelector<HTMLInputElement>('[data-import]')?.addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]

    if (file === undefined) {
      return
    }

    const result = importJSON(await file.text())

    if (result.warning !== null) {
      showMessage(overlay, result.warning)
      input.value = ''
      return
    }

    callbacks.onImport(result.data)
    overlay.remove()
  })

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      overlay.remove()
    }
  })
}
