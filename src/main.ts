import { versionLabel } from './version'

const app = document.querySelector<HTMLDivElement>('#app')

if (app) {
  app.innerHTML = `
    <main style="min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;">
      <section style="text-align: center;">
        <h1 style="margin: 0; font-size: clamp(2rem, 8vw, 4rem); letter-spacing: 0; line-height: 1;">HabitTracker</h1>
        <footer style="margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.75rem; color: #8b949e;">
          ${versionLabel()}
        </footer>
      </section>
    </main>
  `
}
