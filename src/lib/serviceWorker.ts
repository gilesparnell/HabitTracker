// Service worker registration with update detection.
// Forces update checks on app mount, tab visibility, and periodic polling.

export const UPDATE_CHECK_INTERVAL_MS = 60000

export async function registerServiceWorker({ onUpdateAvailable }: { onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void } = {}): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing
      if (!installingWorker) return

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          // Only fire callback if a controller exists (i.e., this is an UPDATE, not first install)
          if (navigator.serviceWorker.controller) {
            if (typeof onUpdateAvailable === 'function') {
              onUpdateAvailable(registration)
            }
          }
        }
      })
    })

    // Force update checks
    const checkForUpdate = () => {
      try {
        const result = registration.update()
        if (result && typeof result.catch === 'function') {
          result.catch(() => {})
        }
      } catch {
        // Silent fail — progressive enhancement
      }
    }

    // Check on mount
    checkForUpdate()

    // Check when tab becomes visible
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate()
        }
      })
    }

    // Poll every UPDATE_CHECK_INTERVAL_MS
    if (typeof setInterval === 'function') {
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    }
  } catch {
    // Silent fail — progressive enhancement
  }
}
