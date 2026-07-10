// Bottom-toast update notification: shows when a new version is detected.

export interface UpdateSummary {
  version: string
  title: string | null
}

function esc(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function showUpdateNotification(
  root: HTMLElement,
  summary: UpdateSummary,
  onRefresh: () => void,
): void {
  // Remove any existing notification
  hideUpdateNotification(root)

  const notification = document.createElement('div')
  notification.setAttribute('data-update-notification', '')
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 0, 38, 0.95);
    border: 1px solid rgba(62, 191, 160, 0.3);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #e0e0e0;
    z-index: 10000;
    max-width: calc(100% - 32px);
  `

  const content = document.createElement('div')
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  `

  const versionLine = document.createElement('span')
  versionLine.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `
  versionLine.textContent = `New version available — v${summary.version}`

  content.appendChild(versionLine)

  if (summary.title) {
    const titleLine = document.createElement('span')
    titleLine.style.cssText = `
      font-size: 11px;
      color: #999;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `
    titleLine.textContent = summary.title
    content.appendChild(titleLine)
  }

  const link = document.createElement('a')
  link.href = `/changelog#${summary.version}`
  link.style.cssText = `
    font-size: 11px;
    color: #38bfa0;
    margin-top: 4px;
    text-decoration: none;
    font-weight: 600;
  `
  link.textContent = "See what's new →"
  content.appendChild(link)

  const button = document.createElement('button')
  button.setAttribute('data-update-refresh', '')
  button.type = 'button'
  button.textContent = 'Refresh'
  button.style.cssText = `
    background: #38bfa0;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  `
  button.addEventListener('click', onRefresh)

  notification.appendChild(content)
  notification.appendChild(button)
  root.appendChild(notification)
}

export function hideUpdateNotification(root: HTMLElement): void {
  const notification = root.querySelector('[data-update-notification]')
  notification?.remove()
}
