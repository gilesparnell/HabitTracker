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

## [0.3.0] — 2026-07-08

### What's new
- The app is now a real, installable habit tracker: two large day counters — nicotine-free and alcohol-free — with your own motivational line under each.
- Opening the app starts with the daily check-in: one honest yes/no per habit, covering the time since you last answered. Miss a few days and a single question covers the gap.
- Slips are handled with dignity: pick the date it happened, confirm, and only the current count restarts — your longest streak and total clean days are always kept. Logged a slip by mistake? Undo it from settings.
- A small "I slipped" action on each counter lets you log the moment it happens instead of waiting for tomorrow's question.
- Friday and Saturday evenings show a quiet supportive line going into the hard nights; weekend check-ins that pass acknowledge you made it through. Milestones (1 day, a week, 30/60/90 days, 6/9 months, a year) get a real celebration.
- One-time sign-in per device with a 6-digit emailed code — after that, no login screens. Your streaks back up to the cloud and restore on a new phone.
- Works fully offline; everything syncs when you're back on a connection.

### Under the hood
- Event-sourced core: an append-only event log is the sole source of truth; all counters derive from a pure fold (`src/domain/`). Sync is union-by-id (`src/sync/`) — conflict-free by construction, with a restore-before-setup gate preventing a fresh device from clobbering cloud data.
- Local-first storage (`src/store/`) with schema-versioned localStorage, quota-safe saves, and JSON export/import.
- Supabase (shared whole-life-challenge project, `ht_`-prefixed tables, append-only RLS) via typed-code email OTP — chosen over magic links because iOS PWAs have partitioned storage from Safari.
- Test suite pinned to Australia/Sydney (`vitest.config.ts`) — domain logic is deliberately local-calendar-dependent and CI runners are UTC.

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
