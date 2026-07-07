import { describe, expect, it } from 'vitest'
import { versionLabel } from './version'

describe('versionLabel', () => {
  it('formats normal semver and sha values', () => {
    expect(versionLabel('0.1.0', 'abcdef1234567890')).toBe('v0.1.0 (abcdef1)')
  })

  it('keeps a sha shorter than 7 characters intact', () => {
    expect(versionLabel('0.1.0', 'abc123')).toBe('v0.1.0 (abc123)')
  })

  it('matches the expected footer label shape', () => {
    expect(versionLabel('12.34.56', '0123456789abcdef')).toMatch(
      /^v\d+\.\d+\.\d+ \([0-9a-f]+\)$/,
    )
  })
})
