# Handoff

Append newest-first handoff entries here with current state, runner, next step, and gotchas.

## 2026-07-08 AEST — Unit 4 complete (local persistence)
**Runner:** Codex. **Next:** Unit 5 — Supabase migration SQL and apply/verify documentation.

Done:
- Added the versioned local store schema and `emptyData()` defaults in `src/store/schema.ts`.
- Added defensive local persistence, backup import/export, dirty-event tracking, config LWW upsert, session, sync cursor, and device milestone mutators in `src/store/local.ts`.
- Added test-first coverage in `src/store/local.test.ts` with a Map-backed fake `StorageLike`; RED was confirmed before implementation and GREEN after.
- Bumped the app version to `0.2.0` and added the Unit 4 changelog entry.

Gotchas:
- `loadData()` and `importJSON()` intentionally discard corrupt or unknown-version stored data for schema v1 and return `emptyData()` with a warning.
- Unit 4 is storage-only; manual browser checks for hard-refresh retention and corrupt stored JSON still belong with the later UI wiring.

## 2026-07-08 AEST — Unit 3 Phase A complete (domain red suite + throwing stubs)
**Runner:** Codex. **Next:** Unit 3 Phase B — replace the `not implemented` domain stubs with real pure-function logic until `npx vitest run src/domain` is green.

Done:
- Added the complete domain test suite for calendar, fold/check-in status, milestones, and support/prompt messages under `src/domain/*.test.ts`.
- Added exact public API stub modules under `src/domain/` with real exported types/constants and throwing function bodies only.
- Verified `npm run lint` passes, so the Phase A tests and stubs type-check under strict TypeScript.
- Verified `npx vitest run src/domain` runs and fails red at runtime with 36 `not implemented` failures across 4 test files.

Gotchas:
- Phase A is intentionally red; do not treat the failing domain suite as a regression until Phase B starts.
- `npx vitest run src/domain 2>&1 | tail -30` exits through `tail`, so use the printed summary, or run without the pipe, when checking the actual Vitest exit status.

## 2026-07-08 AEST — Unit 2 complete (branch protection + Vercel)
**Runner:** Claude. **Next:** Units 3–10 on branch `feat/habit-tracker-core` (codex-delegate for 3,4,5,6,7,9,10; hybrid for 8).

Done:
- Branch protection on `main` via ruleset `main-protection` (id 18626209). Verified by `gh api repos/gilesparnell/HabitTracker/rules/branches/main` — returns `pull_request`, `required_status_checks` (context `Lint · Test · Build`, strict/up-to-date true), `non_fast_forward`, `deletion`. Bypass actors empty (strict, even for admin — merges only via green PR).
- Vercel project `habittracker` created (id `prj_carWENFyCNJVUeZUWzUFute5nNqr`, team `team_oTXOZY867Aq6XqYk3FFwZMAu`), auto-detected Vite, GitHub repo connected for auto-deploy on push.
- Env vars set for production, preview, development: `VITE_SUPABASE_URL` = `https://lnnvwbqmpgusjoplvjjt.supabase.co`, `VITE_SUPABASE_ANON_KEY` = WLC anon JWT (public-by-design; RLS is the boundary).

Gotchas:
- `main` now rejects direct pushes — all work lands via PR. This feature branch carries Units 3–10.
- Vercel CLI `env add … preview` (v50.32.3) refuses non-interactively even with `--yes`; had to POST to `https://api.vercel.com/v10/projects/{id}/env` with `target:["preview"]`. Use the API for future preview-env changes.
- `supabase/.temp` is now gitignored (CLI link artefacts). Unit 5's `supabase/migrations/*.sql` will still commit normally.
