# Decisions

Append project-local tactical decisions here with date, title, rationale, and links.

## 2026-07-11 AEST — Check-in time feature announced retroactively as 0.5.0 (minor), not patched
Discovered the feature had already shipped silently inside 0.4.0-era PRs. Chose a minor bump (0.5.0) with a fresh CHANGELOG entry over extending the 0.4.x range: it's a new user-visible feature that was never announced, and the footer version should let Giles answer "is this the build with the time picker?" at a glance. The entry states explicitly that the code shipped earlier. Residual implementation work (settings regression tests) routed to Codex per routing rules; docs/version stayed with Claude.

## 2026-07-08 AEST — Overnight merge + deploy authorised; single-writer execution
Giles authorised (via main-session relay): public repo, giles@parnellsystems.com as the auth identity, all three live WLC changes (migration, email template token, redirect allowlist), and merge-to-production on green CI without morning review. Separately: after a two-executor collision corrupted a committed test file and duplicated infrastructure, execution is single-writer — one agent owns the tree, Codex runs are strictly sequential, and every unit is verified (suite/lint/build/scope) before commit.

## 2026-07-08 AEST — Test suite pinned to Australia/Sydney
Domain logic is deliberately local-calendar-dependent (R5: calendar-day streaks). CI runners are UTC, which put date-boundary tests on the wrong calendar day (`08:00+10:00` today is yesterday in UTC). Fix: `process.env.TZ = 'Australia/Sydney'` in `vitest.config.ts` rather than making tests timezone-agnostic — the app has exactly one user in exactly one timezone, and deterministic tests beat abstract portability here. See commit 18c3ec1.

## 2026-07-08 AEST — Branch protection via ruleset, not classic protection
Used a repository ruleset (`main-protection`) rather than classic branch protection. Rulesets are the API-native path and the plan's verification command (`gh api .../rules/branches/main`) reads the effective ruleset rules directly. Bypass actors left empty so the default branch is strict for everyone including admin — PRs merge only on green `Lint · Test · Build`. See `docs/handoff/handoff.md`.

## 2026-07-08 AEST — Vercel preview env vars set via REST API
Vercel CLI 50.32.3 `env add … preview` cannot run non-interactively (demands a git-branch argument even with `--yes`). Set the preview-target vars by POSTing to `https://api.vercel.com/v10/projects/{id}/env` with `target:["preview"]` and the CLI's stored token. Production/development went through the CLI fine. Recorded so future env changes skip the dead end.
