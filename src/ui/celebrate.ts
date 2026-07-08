import type { Habit } from '../domain/events'
import { fold } from '../domain/fold'
import { highestNewMilestone } from '../domain/milestones'
import { MADE_IT_THROUGH_TEXT, milestoneMessage, supportMessage } from '../domain/messages'
import type { AppData } from '../store/schema'

export interface CelebrationDecision {
  milestone: number | null
  madeItThrough: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
}

const CONFETTI_COLORS = ['#38bfa0', '#7fe0c8', '#8b7ce6', '#c4b8ff', '#eef1f6'] as const

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function celebrationFor(data: AppData, habit: Habit, todayISO: string, now: Date): CelebrationDecision {
  const currentDays = fold(data.events, todayISO)[habit].currentStreakDays
  const lastCelebrated = data.device.lastCelebratedMilestone[habit]
  const milestone = highestNewMilestone(currentDays, lastCelebrated)

  return {
    milestone,
    madeItThrough: supportMessage(now, todayISO)?.kind === 'made-it-through',
  }
}

export function showMilestoneCelebration(root: HTMLElement, days: number): void {
  root.querySelector('[data-celebration]')?.remove()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.insertAdjacentHTML(
    'beforeend',
    `
      <div class="overlay celebrate-overlay" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" data-celebration>
        ${reduceMotion ? '' : '<canvas class="confetti-canvas" aria-hidden="true"></canvas>'}
        <div class="celebrate-card">
          <p class="kicker">Milestone reached</p>
          <h1 id="celebrate-title"><span>${days}</span> days</h1>
          <p>${esc(milestoneMessage(days))}</p>
        </div>
      </div>
    `,
  )

  const overlay = root.querySelector<HTMLElement>('[data-celebration]')

  if (overlay === null) {
    return
  }

  let dismissed = false
  const dismiss = (): void => {
    if (dismissed) {
      return
    }

    dismissed = true
    overlay.classList.add('leaving')
    window.setTimeout(() => overlay.remove(), 260)
  }

  overlay.addEventListener('click', dismiss)
  window.setTimeout(dismiss, 5000)

  if (!reduceMotion) {
    const canvas = overlay.querySelector<HTMLCanvasElement>('.confetti-canvas')

    if (canvas !== null) {
      runConfetti(canvas)
    }
  }
}

export function showMadeItThroughNote(root: HTMLElement): void {
  root.querySelector('[data-toast-note]')?.remove()

  const cards = root.querySelector('.cards')
  const toast = document.createElement('p')
  toast.className = 'toast-note'
  toast.dataset.toastNote = 'true'
  toast.setAttribute('role', 'status')
  toast.textContent = MADE_IT_THROUGH_TEXT

  if (cards !== null) {
    cards.before(toast)
  } else {
    root.append(toast)
  }

  window.setTimeout(() => {
    toast.classList.add('leaving')
    window.setTimeout(() => toast.remove(), 400)
  }, 4000)
}

function runConfetti(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')

  if (context === null) {
    return
  }

  const ctx = context
  const startedAt = performance.now()
  const duration = 2500
  const particles = makeParticles()

  function resize(): void {
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(window.innerWidth * ratio)
    canvas.height = Math.floor(window.innerHeight * ratio)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  function draw(now: number): void {
    const elapsed = now - startedAt
    const progress = Math.min(1, elapsed / duration)
    const width = window.innerWidth
    const height = window.innerHeight

    ctx.clearRect(0, 0, width, height)

    for (const particle of particles) {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += 0.08
      particle.rotation += particle.spin

      ctx.save()
      ctx.globalAlpha = 1 - Math.max(0, progress - 0.68) / 0.32
      ctx.translate(particle.x * width, particle.y * height)
      ctx.rotate(particle.rotation)
      ctx.fillStyle = particle.color
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.42)
      ctx.restore()
    }

    if (elapsed < duration) {
      requestAnimationFrame(draw)
    } else {
      ctx.clearRect(0, 0, width, height)
    }
  }

  resize()
  requestAnimationFrame(draw)
}

function makeParticles(): Particle[] {
  return Array.from({ length: 40 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1

    return {
      x: side === -1 ? -0.04 : 1.04,
      y: 0.28 + Math.random() * 0.24,
      vx: side * -(0.006 + Math.random() * 0.012),
      vy: -0.006 - Math.random() * 0.014,
      size: 7 + Math.random() * 9,
      rotation: Math.random() * Math.PI,
      spin: -0.12 + Math.random() * 0.24,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }
  })
}
