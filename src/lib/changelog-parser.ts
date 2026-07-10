// Parse CHANGELOG.md to extract version entries and what's-new summaries.

export interface ChangelogEntry {
  version: string
  title: string | null
}

/**
 * Extract the latest version and its first "What's new" item from changelog text.
 * Returns null if no valid entry found.
 *
 * Parses formats like:
 * - ## [0.3.4] — 2026-07-09
 * - ## [0.3.0 → 0.3.3] — 2026-07-08
 */
export function getLatestWhatsNew(changelogText: string): ChangelogEntry | null {
  const lines = changelogText.split('\n')

  let version: string | null = null
  let inWhatsNew = false
  let title: string | null = null

  for (const line of lines) {
    // Look for version header: ## [X.Y.Z] — DATE or ## [X → Y] — DATE
    if (line.startsWith('## [')) {
      const match = line.match(/## \[([^\]]+)\]/)
      if (match) {
        version = match[1]
      }
      inWhatsNew = false
      continue
    }

    // If we found a version and see "### What's new", start capturing
    if (version && line === '### What\'s new') {
      inWhatsNew = true
      continue
    }

    // If we were in "What's new" section and see another heading, we're done
    if (inWhatsNew && line.startsWith('### ')) {
      break
    }

    // Capture first bullet point in "What's new" as the title
    if (inWhatsNew && line.startsWith('- ') && !title) {
      title = line.slice(2).trim()
      // We have version and title — we can return now
      if (version) {
        return { version, title }
      }
    }
  }

  // Return what we found, or null if nothing
  return version ? { version, title } : null
}

/**
 * Parse changelog into structured entries for rendering.
 */
export interface ParsedChangelogEntry {
  version: string
  date: string | null
  whatsNew: string[]
  underTheHood: string[]
}

export function parseChangelogEntries(changelogText: string): ParsedChangelogEntry[] {
  const entries = []
  const lines = changelogText.split('\n')

  let currentEntry: {
    version: string
    date: string | null
    whatsNew: string[]
    underTheHood: string[]
  } | null = null
  let currentSection: 'whatsNew' | 'underTheHood' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Version header: ## [X.Y.Z] — DATE
    if (line.startsWith('## [')) {
      if (currentEntry) {
        entries.push(currentEntry)
      }
      const match = line.match(/## \[([^\]]+)\].*— (.+)/)
      currentEntry = {
        version: match?.[1] || '',
        date: match?.[2] || null,
        whatsNew: [],
        underTheHood: [],
      }
      currentSection = null
      continue
    }

    if (!currentEntry) continue

    // Section headers
    if (line === '### What\'s new') {
      currentSection = 'whatsNew'
      continue
    }
    if (line === '### Under the hood') {
      currentSection = 'underTheHood'
      continue
    }

    // Bullet points
    if (line.startsWith('- ') && currentSection) {
      const bullet = line.slice(2).trim()
      if (currentSection === 'whatsNew') {
        currentEntry.whatsNew.push(bullet)
      } else {
        currentEntry.underTheHood.push(bullet)
      }
    }
  }

  if (currentEntry) {
    entries.push(currentEntry)
  }

  return entries
}
