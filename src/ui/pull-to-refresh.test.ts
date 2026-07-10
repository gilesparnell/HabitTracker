import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPullToRefreshHandler } from './pull-to-refresh'

describe('createPullToRefreshHandler', () => {
  let element: HTMLElement
  let onRefresh: ReturnType<typeof vi.fn>

  beforeEach(() => {
    element = document.createElement('div')
    onRefresh = vi.fn()
  })

  describe('happy path', () => {
    it('calls onRefresh when user swipes down at least 80px from top', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      // Simulate swipe down from top
      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 0 } as Touch],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 100 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('detects swipe down of exactly 80px threshold', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 0 } as Touch],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 80 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).toHaveBeenCalledOnce()
    })
  })

  describe('sad path', () => {
    it('does not call onRefresh when swipe distance is less than 80px', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 0 } as Touch],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 79 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('does not call onRefresh for upward swipe', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 100 } as Touch],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 20 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('ignores touches that do not start at top of page', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 200 } as Touch],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 300 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('does not call onRefresh without a touchend event', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientY: 0 } as Touch],
      })

      element.dispatchEvent(touchStart)

      expect(onRefresh).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles multiple touches (uses first touch)', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [
          { clientY: 0 } as Touch,
          { clientY: 50 } as Touch,
        ],
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientY: 100 } as Touch],
      })

      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchEnd)

      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('resets state after successful refresh', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)

      // First swipe
      element.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientY: 0 } as Touch],
        }),
      )
      element.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          changedTouches: [{ clientY: 100 } as Touch],
        }),
      )

      // Second swipe should work independently
      element.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientY: 10 } as Touch],
        }),
      )
      element.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          changedTouches: [{ clientY: 110 } as Touch],
        }),
      )

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('provides cleanup function to remove listeners', () => {
      const handler = createPullToRefreshHandler(element, onRefresh)
      handler.cleanup()

      // After cleanup, touch events should not trigger callback
      element.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientY: 0 } as Touch],
        }),
      )
      element.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          changedTouches: [{ clientY: 100 } as Touch],
        }),
      )

      expect(onRefresh).not.toHaveBeenCalled()
    })
  })
})
