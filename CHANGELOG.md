# Changelog

All notable changes. Bumped on every PR that ships to production.

## Conventions
- patch (0.0.x) — bug fixes, copy tweaks, dependency bumps
- minor (0.x.0) — new features, new pages, new tracked events
- major (x.0.0) — breaking changes

Each entry is split into:
- **What's new** — customer-facing outcomes
- **Under the hood** — technical detail

---

## [0.2.0] — 2026-07-08

### What's new
- Habit data now survives refreshes and can be exported or restored from a backup file.
- Damaged local data now falls back to a clean start with a warning instead of crashing the app.

### Under the hood
- Added the Unit 4 local persistence API in `src/store/schema.ts` and `src/store/local.ts`, including schema-version validation, defensive JSON import, dirty-event tracking, config LWW updates, session storage, sync cursor storage, and device-only milestone state.
- Added test-first Vitest coverage in `src/store/local.test.ts` using a Map-backed `StorageLike` fake rather than browser `localStorage`.

## [0.1.0] — 2026-07-08

### What's new
- Project scaffolded; nothing user-visible yet.

### Under the hood
- Vite, TypeScript, and Vitest tooling scaffolded for the app.
- Build-time version injection added for the app semver, git SHA, and build time.
- Version footer and initial test coverage added for the version label.
