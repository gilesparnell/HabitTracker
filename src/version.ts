export function versionLabel(semver = __APP_SEMVER__, sha = __APP_VERSION__): string {
  return `v${semver} (${sha.slice(0, 7)})`
}
