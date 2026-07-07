---
date: 2026-07-07
topic: sobriety-habit-tracker
---

# Personal Sobriety Habit Tracker

## Problem Frame
Giles wants a personal, single-user app to track two ongoing quit streaks — vaping and drinking — with a daily check-in ritual, motivational reinforcement, and celebration that feels meaningful rather than gimmicky. The original spec (from Granola notes) assumed a fully local, no-backend static HTML page. Brainstorming surfaced one critical gap: streak data with no cloud backup is a single point of failure — losing or replacing the phone would silently erase a long streak, which defeats the app's purpose. Research into existing sobriety/streak apps (I Am Sober, Nomo, Streaks, Loop Habit Tracker) informed several other product decisions below.

## Requirements

- R1. Two large, central counters — one for vaping, one for drinking — each showing days since a user-supplied start date.
- R2. On app open, if there has been no check-in today, prompt with two yes/no questions before showing anything else: "Did you vape?" / "Did you drink?" Each habit is independent (answering one doesn't affect the other). A check-in covers the period **since the last check-in** (not an ambiguous "today"), which keeps the question well-defined whenever it's asked.
- R3. **Relapse handling**: answering "yes" to a habit opens a date-picker defaulting to today with a "Confirm reset" action — one step, the date confirmation *is* the confirmation (supports logging a relapse a day or two after it happened). The current streak resets from that date. **Longest streak** and **total clean days** are permanently preserved as separate lifetime stats and are never erased by a reset.
- R3a. **Same-day slip logging**: each habit card carries a small, dignified "I slipped" action so a relapse can be logged the moment it happens — even after that day's check-in — feeding the same reset-with-date flow as R3. Relapses are never logged via the settings menu.
- R4. **Missed-day catch-up**: if the user reopens the app after one or more days without a check-in, show a single summary prompt per habit ("Did you stay clean the whole time?" yes/no) rather than day-by-day backfill or silently assuming success.
- R5. **Day boundary**: a "day" is defined by local calendar-date string comparison (e.g. `2026-07-07` vs `2026-07-06`), not a rolling 24-hour window or UTC-based comparison, to avoid the timezone/travel bugs common in streak apps.
- R6. **Celebration UX**:
  - Daily "yes, stayed clean" answers get an understated acknowledgment (checkmark, subtle glow) — no full animation.
  - Milestones (24h, 1 week, 30/60/90 days, 6 months, 9 months, 1 year, then yearly) trigger a full celebratory animation. Milestones already passed at initial setup (pre-existing start date) do not fire retroactive animations.
  - **Hardest-nights support, both sides**: Friday/Saturday evening opens show a supportive acknowledging line going into the hard night; the following morning's passing check-in gets a warmer "you made it through" note. Two small text variations — no extra screens, no bigger confetti.
- R7. Hamburger menu (top-left) with settings: manually reset an individual habit's start date, and manually reset an individual habit's counter — a manual override path independent of the daily relapse flow (e.g. to correct a mistake).
- R8. Motivational text displayed beneath each counter (why to stop vaping / why to stop drinking).
- R9. **Persistence — local-first with cloud sync**: device storage is the primary store (instant load, fully functional offline, including check-ins); every change syncs through to Supabase whenever the network is available, reusing the existing `whole-life-challenge` project (new `habits` / `checkins` tables) rather than provisioning a new one. Supabase is the backup/recovery source if the phone is lost or replaced — never a prerequisite for daily use.
- R10. **Auth — magic link, once per device**: setting up a device asks for an email once and authenticates via Supabase magic link; after that, no auth UI ever appears on that device. Recovery on a new phone is the same one-time magic-link step. (Supabase anonymous auth was rejected: an anonymous user whose device token is lost is unrecoverable — there is no "recovery code" mechanism.)
- R11. Installable as an iOS PWA (Add to Home Screen) — fits an iPhone screen, feels app-like, no native iOS integration required. Served from static hosting (Vercel by default; no server code needed).
- R12. **Visual style**: dark glassmorphism — dark background, frosted-glass translucent cards, soft neon/gradient accents, clean modern sans-serif typography. Counters large and central.

## Success Criteria
- Opening the app takes the user straight to the day's check-in (or straight to counters if already answered), in well under 10 seconds — including with no network connection.
- A relapse never destroys historical progress data — longest streak and lifetime clean days always survive a reset.
- Losing or replacing the phone does not lose the streak — data recovers via Supabase after the one-time magic-link step on the new device.
- A slip can be logged the moment it happens, from the main screen, without visiting settings.
- Daily interaction feels calm and dignified, not gimmicky; milestone moments feel genuinely celebratory by contrast.
- No auth UI appears after a device's initial setup.

## Scope Boundaries
- No native iOS app — web/PWA only.
- No push notifications or reminders (not requested).
- No multi-user support, sharing, or social features.
- No analytics/reporting beyond the two counters and each habit's longest-streak/lifetime-clean-days stat.
- No new Supabase project — reuses existing `whole-life-challenge` project rather than provisioning new infrastructure.

## Key Decisions
- **Local-first + Supabase sync over either extreme**: local-only risks silent data loss (Safari storage eviction, lost phone); Supabase-primary makes the app useless offline — at exactly the late-night moments it matters most. Local storage is the working store; Supabase is the write-through backup and recovery source. Reusing the existing `whole-life-challenge` project avoids new infrastructure cost or project-count limits.
- **Magic-link auth over anonymous sessions**: Supabase anonymous users are unrecoverable if the device token is lost, which would recreate the exact data-loss risk Supabase was chosen to eliminate. One visible auth moment per device lifetime is the accepted cost; it also keeps the shared WLC auth pool clean (the user is identifiably Giles, not an orphaned anonymous row).
- **Explicit "I slipped" action + since-last-check-in semantics**: without it, a same-day slip has no first-class logging path (waiting for tomorrow's prompt leaves the counter wrong overnight, and the prompt's time window becomes ambiguous). Defining check-ins as covering "since the last check-in" makes the question well-defined at any hour.
- **Reset-with-editable-date over hard/instant reset**: chosen over an immediate no-confirmation reset so a relapse can be logged accurately (e.g. a day later) without extra friction of a separate confirm dialogue blocking the flow.
- **Summary catch-up over day-by-day backfill or silent continuation**: balances accuracy against not making missed days feel like an interrogation — informed by research showing rigid backfill flows create friction in recovery-app contexts.
- **Local calendar-date comparison over UTC/rolling-24h**: research identified UTC-based day logic as the most common source of streak-tracking bugs, especially across timezones/travel.
- **Milestone-gated celebration over daily confetti**: research across sobriety apps (I Am Sober, Nomo, Sober Grid) shows daily full-screen celebration reads as gimmicky/infantilizing over months of use; reserving big moments for milestones keeps them meaningful.

## Dependencies / Assumptions
- Assumes continued access to the existing `whole-life-challenge` Supabase project (already provisioned under Giles's Vercel-managed Supabase org).
- Habit-tracker tables live in the WLC Supabase project, so their schema migrations sit outside this app's repo's natural home — the plan must state explicitly where those migration files live and how they're applied (per the migrations-are-explicit rule).
- Assumes motivational text (R8) is editable by the user via settings rather than fixed at build time — reasonable default, not yet explicitly confirmed.
- Static hosting on Vercel is the default assumption for R11; deployment triggers the standard Versioning Discipline requirements (version in footer, CHANGELOG).

## Outstanding Questions

### Deferred to Planning
- [Affects R9][Technical] Sync-conflict policy when two devices both hold unsynced changes (rare for a single user, but the plan should pick a rule — likely last-write-wins per habit).
- [Affects R6][Technical] Exact hour window that counts as Friday/Saturday "evening" for the night-of supportive message, and which morning check-ins count as "made it through".
- [Affects R8] Should motivational text be user-editable in the hamburger menu, or fixed once at initial setup?
- [Affects R7][Technical] Should the manual "reset counter" in settings also require a confirmation step, matching the relapse-flow date confirmation in R3?

## Next Steps
→ /ce:plan for structured implementation planning
