import { defineConfig } from 'vitest/config'

// Domain logic is deliberately local-timezone-dependent (calendar-day streaks, R5).
// Pin the suite to the app's home timezone so results are identical on any
// machine — CI runners are UTC and would otherwise sit on the wrong calendar day.
process.env.TZ = 'Australia/Sydney'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
})
