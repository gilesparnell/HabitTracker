import { todayLocalISO } from '../domain/calendar'
import type { Habit } from '../domain/events'
import { versionLabel } from '../version'
import type { PromptVM, ScreenModel } from './viewmodel'

export interface Handlers {
  onAnswerClean(habit: Habit, kind: 'daily' | 'catchup'): void
  onRelapseConfirmed(habit: Habit, dateISO: string): void
  onOpenSettings(): void
}

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function counterCard(model: ScreenModel, habit: Habit): string {
  const counter = model.counters.find((item) => item.habit === habit)

  if (counter === undefined) {
    return ''
  }

  return `
    <section class="card ${habit}" data-habit="${habit}" aria-label="Days ${esc(counter.label.toLowerCase())}">
      <p class="label">${esc(counter.label)}</p>
      <div class="count"><span class="num">${counter.days}</span><span class="unit">days</span></div>
      <p class="why">${esc(counter.motivationalText)}</p>
      <div class="card-foot">
        <span class="stats">best ${counter.best} · clean ${counter.totalClean}</span>
        <button class="slipped" data-slipped="${habit}">I slipped</button>
      </div>
    </section>
  `
}

function checkinSheet(prompt: PromptVM, answeredCount: number, totalDue: number): string {
  const dots = Array.from({ length: totalDue }, (_, index) => `<i class="${index <= answeredCount ? 'on' : ''}"></i>`).join('')

  return `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="checkin-question" data-checkin="${prompt.habit}">
      <div class="sheet">
        <p class="kicker">Daily check-in</p>
        <h1 id="checkin-question">${esc(prompt.question)}</h1>
        <p class="window-note">${esc(prompt.windowNote)}</p>
        <div class="answers">
          <button class="primary" data-answer="clean">No<span class="sub">stayed clean</span></button>
          <button class="secondary" data-answer="relapse">Yes<span class="sub">log it honestly</span></button>
        </div>
        <div class="progress" aria-hidden="true">${dots}</div>
      </div>
    </div>
  `
}

export function relapseSheet(habit: Habit, minDateISO: string | null): string {
  const today = todayLocalISO()

  return `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="relapse-title" data-relapse="${habit}">
      <div class="sheet">
        <p class="kicker">Reset ${habit === 'vape' ? 'nicotine' : 'alcohol'} streak</p>
        <h1 id="relapse-title">When did it happen?</h1>
        <label class="field-label" for="relapse-date">Date of the slip</label>
        <input type="date" id="relapse-date" value="${today}" max="${today}" ${minDateISO ? `min="${minDateISO}"` : ''} />
        <p class="reassure">Your longest streak and total clean days are kept. This only restarts the current count.</p>
        <div class="sheet-actions">
          <button class="cancel" data-relapse-cancel>Cancel</button>
          <button class="confirm" data-relapse-confirm>Confirm reset</button>
        </div>
      </div>
    </div>
  `
}

export function renderApp(root: HTMLElement, model: ScreenModel, handlers: Handlers, warning: string | null): void {
  if (model.needsSetup) {
    root.innerHTML = `
      <div class="aurora"></div>
      <div class="app">
        <main class="placeholder" data-setup-root>
          <p>Welcome. Setup starts with a one-time sign-in.<br />This screen is completed in the device-setup flow.</p>
        </main>
        <footer>${esc(versionLabel())}</footer>
      </div>
    `
    return
  }

  const answeredToday = 2 - (model.prompt === null ? 0 : 1)

  root.innerHTML = `
    <div class="aurora"></div>
    <div class="app">
      ${warning ? `<div class="warning-banner" role="status">${esc(warning)}</div>` : ''}
      <header>
        <button class="menu-btn" aria-label="Settings" data-menu>
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true">
            <path d="M1 1h18M1 7h18M1 13h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        ${model.supportLine ? `<p class="support-line">${esc(model.supportLine)}</p>` : ''}
      </header>
      <main class="cards">
        ${counterCard(model, 'vape')}
        ${counterCard(model, 'drink')}
      </main>
      <footer>${esc(versionLabel())}</footer>
    </div>
    ${model.prompt ? checkinSheet(model.prompt, answeredToday, 2) : ''}
  `

  root.querySelector('[data-menu]')?.addEventListener('click', () => handlers.onOpenSettings())

  const prompt = model.prompt
  if (prompt !== null) {
    root.querySelector('[data-answer="clean"]')?.addEventListener('click', () => {
      handlers.onAnswerClean(prompt.habit, prompt.status === 'catchup' ? 'catchup' : 'daily')
    })
    root.querySelector('[data-answer="relapse"]')?.addEventListener('click', () => {
      openRelapseSheet(root, prompt.habit, handlers)
    })
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-slipped]')) {
    button.addEventListener('click', () => {
      const habit = button.dataset.slipped as Habit
      openRelapseSheet(root, habit, handlers)
    })
  }
}

export function openRelapseSheet(root: HTMLElement, habit: Habit, handlers: Handlers): void {
  const existing = root.querySelector('[data-relapse]')
  existing?.remove()

  root.insertAdjacentHTML('beforeend', relapseSheet(habit, null))
  const overlay = root.querySelector<HTMLElement>('[data-relapse]')

  overlay?.querySelector('[data-relapse-cancel]')?.addEventListener('click', () => overlay.remove())
  overlay?.querySelector('[data-relapse-confirm]')?.addEventListener('click', () => {
    const input = overlay.querySelector<HTMLInputElement>('#relapse-date')
    const dateISO = input?.value || todayLocalISO()
    overlay.remove()
    handlers.onRelapseConfirmed(habit, dateISO)
  })
}

export function flashAck(root: HTMLElement, habit: Habit): void {
  const card = root.querySelector(`.card.${habit}`)

  if (card === null) {
    return
  }

  card.classList.remove('acked')
  requestAnimationFrame(() => card.classList.add('acked'))
  window.setTimeout(() => card.classList.remove('acked'), 1800)
}
