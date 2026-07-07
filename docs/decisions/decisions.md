# Decisions

Append project-local tactical decisions here with date, title, rationale, and links.

## 2026-07-08 AEST — Branch protection via ruleset, not classic protection
Used a repository ruleset (`main-protection`) rather than classic branch protection. Rulesets are the API-native path and the plan's verification command (`gh api .../rules/branches/main`) reads the effective ruleset rules directly. Bypass actors left empty so the default branch is strict for everyone including admin — PRs merge only on green `Lint · Test · Build`. See `docs/handoff/handoff.md`.

## 2026-07-08 AEST — Vercel preview env vars set via REST API
Vercel CLI 50.32.3 `env add … preview` cannot run non-interactively (demands a git-branch argument even with `--yes`). Set the preview-target vars by POSTing to `https://api.vercel.com/v10/projects/{id}/env` with `target:["preview"]` and the CLI's stored token. Production/development went through the CLI fine. Recorded so future env changes skip the dead end.
