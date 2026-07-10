// Pull-to-refresh gesture handler for mobile.
// Detects downward swipe from top of page and triggers refresh callback.

const PULL_THRESHOLD = 80 // pixels
const TOP_THRESHOLD = 50 // pixels — allow touches starting within this distance from top

export interface PullToRefreshHandler {
  cleanup(): void
}

export function createPullToRefreshHandler(
  element: HTMLElement,
  onRefresh: () => void,
): PullToRefreshHandler {
  let touchStartY: number | null = null

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (touch) {
      touchStartY = touch.clientY
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartY === null) {
      return
    }

    const touch = event.changedTouches[0]
    if (!touch) {
      touchStartY = null
      return
    }

    const touchEndY = touch.clientY
    const distance = touchEndY - touchStartY
    const startedNearTop = touchStartY <= TOP_THRESHOLD

    // Reset state
    touchStartY = null

    // Check if swipe was from near top of page and distance is at least PULL_THRESHOLD
    if (startedNearTop && distance >= PULL_THRESHOLD) {
      onRefresh()
    }
  }

  element.addEventListener('touchstart', handleTouchStart)
  element.addEventListener('touchend', handleTouchEnd)

  return {
    cleanup() {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    },
  }
}
