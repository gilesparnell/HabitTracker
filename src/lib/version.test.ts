import { describe, expect, it } from 'vitest'
import { getVersion, getShortVersion, getSemver, getDisplayVersion } from './version'
import { getLatestWhatsNew } from './changelog-parser'

describe('version helpers', () => {
  it('returns dev for missing __APP_VERSION__', () => {
    expect(getVersion()).toBe('dev')
  })

  it('returns dev for getShortVersion when in dev mode', () => {
    expect(getShortVersion()).toBe('dev')
  })

  it('returns 0.0.0 for missing __APP_SEMVER__', () => {
    expect(getSemver()).toBe('0.0.0')
  })

  it('formats display version as v{semver} ({short-sha})', () => {
    const displayed = getDisplayVersion()
    expect(displayed).toMatch(/^v\d+\.\d+\.\d+/)
  })
})

describe('getLatestWhatsNew', () => {
  it('extracts version and title from first changelog entry', () => {
    const changelog = `# Changelog

## [0.3.4] — 2026-07-09

### What's new
- Feature 1
- Feature 2

### Under the hood
- Technical detail
`
    const latest = getLatestWhatsNew(changelog)
    expect(latest).toEqual({
      version: '0.3.4',
      title: 'Feature 1',
    })
  })

  it('returns null if no changelog entries found', () => {
    const changelog = '# Changelog\n\nNo entries yet'
    const latest = getLatestWhatsNew(changelog)
    expect(latest).toBeNull()
  })

  it('extracts from version range format like [0.3.0 → 0.3.3]', () => {
    const changelog = `# Changelog

## [0.3.0 → 0.3.3] — 2026-07-08

### What's new
- Fixed sign-in
`
    const latest = getLatestWhatsNew(changelog)
    expect(latest?.version).toBe('0.3.0 → 0.3.3')
  })
})
