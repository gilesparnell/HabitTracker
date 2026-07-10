// Reads the build-time version + timestamp injected by vite.config.js via `define`.
// The globals are replaced with literal strings at build time; in dev they fall back to defaults.

export function getVersion(): string {
  const v = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
  return v && v.length > 0 ? v : 'dev'
}

export function getShortVersion(): string {
  const v = getVersion()
  if (v === 'dev') return 'dev'
  return v.slice(0, 7)
}

export function getSemver(): string {
  const v = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : ''
  return v && v.length > 0 ? v : '0.0.0'
}

export function getDisplayVersion(): string {
  return `v${getSemver()} (${getShortVersion()})`
}
