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

## [0.4.0] — 2026-07-10

### What's new
- App now detects when a new version is deployed and shows a persistent toast notification at the bottom of the screen. Click "Refresh" to reload with the new version, "See what's new" to view the changelog, or the close button (✕) to dismiss.
- New changelog page displays your full version history with feature summaries and technical details. Each version links to its specific section so you can reference past releases.
- Version now displays in the footer as `vX.Y.Z (git-sha)` so you can tell exactly which version is running.

### Under the hood
- Service worker registers on app load and checks for updates every 60 seconds, plus on tab visibility change and app mount. When a new build is detected, it fires an `updatefound` event.
- Changelog parsed from `CHANGELOG.md` at build time; latest version extracted and shown in notification toast via `getLatestWhatsNew()`.
- Notification rendered in a separate DOM container outside the app root to persist across rerenders; users can interact with it or dismiss at any time.
- Build-time injection via Vite: `__APP_SEMVER__` (from package.json), `__APP_VERSION__` (git SHA), `__BUILD_TIME__` (ISO timestamp) injected into globals.
- Service worker BUILD_ID placeholder replaced at build time with git SHA to ensure browser detects new SW on every deploy.

## [0.3.4] — 2026-07-09

### What's new
- Rainbow Aurora theme: vibrant animated gradient background with living colour shifts. Per-habit cards now glow with habit-specific coloured glass (teal/cyan for nicotine, magenta/orange for alcohol). Primary action button is now a vivid teal-to-cyan gradient.
- Milestone celebrations now rain confetti: 70 CSS-animated pieces falling continuously until dismissed, replacing the canvas engine.
- Day counter numbers now count up from 0 on app load with easing, creating a satisfying entry animation.

### Under the hood
- CSS theme system overhauled: moved from cool-teal glass palette to deep-purple base with 15s aurora-shift animation (`src/styles/main.css`).
- Confetti celebration swapped canvas `Particle` engine for CSS rain (`src/ui/celebrate.ts` unchanged structurally; CSS in `main.css` replaced `.confetti-canvas` with `.confetti-rain` + `.confetti-piece` + `@keyframes confetti-fall`).
- Added `animateCounts()` helper in `src/ui/render.ts` with cubic-ease easing and staggered timing; respects `prefers-reduced-motion`.

## [0.3.0 → 0.3.3] — 2026-07-08/09

### What's new
- Fixed (0.3.3): phones no longer sign you out on every relaunch — data restored from the cloud was being wrongly rejected as invalid the next time the app opened.
- Fixed (fully, in 0.3.2): sign-in codes were still being clipped to 6 digits by an input handler even after the field itself was widened — the field was clamped to 6 digits while this project issues 8-digit codes, so every code was silently truncated and rejected.
- The app is now a real, installable habit tracker: two large day counters — nicotine-free and alcohol-free — with your own motivational line under each.
- Opening the app starts with the daily check-in: one honest yes/no per habit, covering the time since you last answered. Miss a few days and a single question covers the gap.
- Slips are handled with dignity: pick the date it happened, confirm, and only the current count restarts — your longest streak and total clean days are always kept. Logged a slip by mistake? Undo it from settings.
- A small "I slipped" action on each counter lets you log the moment it happens instead of waiting for tomorrow's question.
- Friday and Saturday evenings show a quiet supportive line going into the hard nights; weekend check-ins that pass acknowledge you made it through. Milestones (1 day, a week, 30/60/90 days, 6/9 months, a year) get a real celebration.
- One-time sign-in per device with a 6-digit emailed code — after that, no login screens. Your streaks back up to the cloud and restore on a new phone.
- Works fully offline; everything syncs when you're back on a connection.

### Under the hood
- 0.3.3: Postgres returns explicit `null` for unset optional columns while locally-created events omit them; the stored-data validator only accepted absence. Cloud-restored events now normalise `null` → absent at both the sync boundary (`src/sync/transport.ts`) and load time (`src/store/local.ts`), with regression tests.
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
