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

## [0.1.0] — 2026-07-08

### What's new
- Project scaffolded; nothing user-visible yet.

### Under the hood
- Vite, TypeScript, and Vitest tooling scaffolded for the app.
- Build-time version injection added for the app semver, git SHA, and build time.
- Version footer and initial test coverage added for the version label.
