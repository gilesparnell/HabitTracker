import { describe, expect, it } from 'vitest'
import type { UpdateSummary } from './update-notification'

describe('update notification types', () => {
  it('UpdateSummary interface accepts version and optional title', () => {
    const summary1: UpdateSummary = { version: '0.3.4', title: 'New features!' }
    const summary2: UpdateSummary = { version: '0.3.4', title: null }

    expect(summary1.version).toBe('0.3.4')
    expect(summary1.title).toBe('New features!')
    expect(summary2.title).toBeNull()
  })
})
