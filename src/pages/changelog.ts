import { parseChangelogEntries } from '../lib/changelog-parser'
import { getDisplayVersion } from '../lib/version'

// Import CHANGELOG.md as raw text via Vite ?raw loader
import CHANGELOG_TEXT from '../../CHANGELOG.md?raw'

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function renderChangelogPage(root: HTMLElement, anchorId?: string): void {
  const entries = parseChangelogEntries(CHANGELOG_TEXT)

  root.innerHTML = `
    <div class="changelog-container" style="padding: 20px; max-width: 800px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h1 style="margin: 0;">Version History</h1>
        <a href="/" style="text-decoration: none; color: #38bfa0;">← Back</a>
      </div>

      <p style="color: #999; margin-bottom: 30px;">Current version: ${esc(getDisplayVersion())}</p>

      ${entries
        .map(
          (entry) => `
        <div id="${esc(entry.version)}" class="changelog-entry" style="margin-bottom: 30px; padding: 15px; background: rgba(255,255,255,0.02); border-left: 3px solid #38bfa0; border-radius: 4px;">
          <h2 style="margin: 0 0 5px 0; font-size: 16px;">v${esc(entry.version)}${entry.date ? ` — ${esc(entry.date)}` : ''}</h2>

          ${
            entry.whatsNew.length > 0
              ? `
            <h3 style="margin: 10px 0 5px 0; font-size: 13px; font-weight: 600; color: #38bfa0;">What's new</h3>
            <ul style="margin: 5px 0 10px 0; padding-left: 20px; font-size: 13px; color: #e0e0e0; line-height: 1.6;">
              ${entry.whatsNew.map((item) => `<li>${esc(item)}</li>`).join('')}
            </ul>
          `
              : ''
          }

          ${
            entry.underTheHood.length > 0
              ? `
            <h3 style="margin: 10px 0 5px 0; font-size: 13px; font-weight: 600; color: #999;">Under the hood</h3>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 12px; color: #999; line-height: 1.6;">
              ${entry.underTheHood.map((item) => `<li>${esc(item)}</li>`).join('')}
            </ul>
          `
              : ''
          }
        </div>
      `,
        )
        .join('')}
    </div>
  `

  // Scroll to anchor if provided
  if (anchorId) {
    const element = root.querySelector(`#${anchorId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }
}
