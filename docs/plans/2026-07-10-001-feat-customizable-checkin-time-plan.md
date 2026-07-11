---
title: feat: Customisable Daily Check-In Time
type: feat
status: completed
date: 2026-07-10
---

# Customisable Daily Check-In Time

## Overview

Currently, HabitTracker shows the daily check-in prompt based purely on calendar date — once you answer "did you stay clean?", the prompt doesn't reappear until the next calendar day, regardless of time. Users report that check-ins appear late at night, which feels unnatural.

This feature lets users set an exact preferred check-in time (default 7:00 AM) in their device's local timezone. Check-ins will only appear after that time each day, and once answered, won't prompt again until the same time the next calendar day.

## Problem Statement / Motivation

Check-in timing significantly impacts user experience in sobriety tracking:
- Prompting at 11 PM feels jarring; users would rather face the question fresh in the morning.
- A fixed time creates a daily ritual — a moment to pause and check in with themselves.
- Behavioural psychology: morning check-ins align with habit-formation patterns better than late-night prompts.
- Current behaviour: first app open of a new day triggers prompt immediately, regardless of user preference.

## Proposed Solution

### High-Level Approach

1. **Add `checkInTime` to user config** — store as ISO time string (`"HH:MM"`, e.g., `"07:00"`) per-user globally (not per-habit).

2. **Modify check-in status logic** — extend `checkinStatus()` to check both:
   - **Calendar boundary**: Has a check-in been answered today (local ISO date)?
   - **Time threshold**: Has the device-local time passed the configured check-in time?
   - **Decision tree**:
     - If today's check-in already answered → `'none'` (no prompt)
     - If today's check-in not answered AND current local hour >= check-in hour → `'standard'` (prompt immediately)
     - If today's check-in not answered AND current local hour < check-in hour → `'none'` (wait until later)

3. **Add UI time picker** — new settings row with `<input type="time">` to set preferred time.

4. **Fallback behaviour** — if user hasn't set a time, default to `"07:00"`.

5. **Timezone handling** — use device-local hour only; store time as local time. Deferred decision: travel across timezones (addressed in Future Considerations).

## Technical Approach

### Data Model Changes

**Add field to `HabitConfig`** (`src/store/schema.ts`):

```typescript
export interface HabitConfig {
  habit: Habit
  motivationalText: string
  checkInTime?: string  // ISO time format: "HH:MM", e.g., "09:00"
  updatedAt: string     // LWW timestamp
}
```

**Default behaviour**:
- If `checkInTime` is undefined, treat as `"07:00"`
- Store as local time string (no timezone offset)
- Same LWW semantics as `motivationalText` (last write wins by `updatedAt`)

### Logic Changes

**Extend `checkinStatus()`** in `src/domain/fold.ts`:

Current signature:
```typescript
export function checkinStatus(state: HabitState, todayISO: string): CheckinStatus
```

New signature:
```typescript
export function checkinStatus(
  state: HabitState,
  todayISO: string,
  now?: Date,
  configuredTime?: string  // "HH:MM" or undefined
): CheckinStatus
```

**Decision logic**:
```
1. If lastInteractionDate === todayISO:
     → 'none' (already checked in today)
2. If lastInteractionDate !== todayISO (need to check in):
     a. Extract hour from now (default new Date())
     b. Extract configured time hour (default "07:00")
     c. If current hour >= configured hour:
          → return 'standard' or 'catchup' (based on day gap)
     d. Else:
          → return 'none' (wait until configured time)
```

**Backward compatibility**:
- Existing code that calls `checkinStatus(state, todayISO)` continues to work.
- Tests inject `now` and `configuredTime` for determinism.

### UI Changes

**Settings modal** (`src/ui/settings.ts`):

Add new row for each habit (after motivational text, before start-date correction):

```typescript
// In habitSettingsSection() rendering loop
label.className = 'settings-row'
label.innerHTML = `
  <span>
    <strong>Daily check-in time</strong>
    <small>Prompt appears after this time each day</small>
  </span>
  <input type="time" 
         id="checkin-time-${habit}" 
         value="${getCheckInTime(data, habit)}"
         aria-label="Check-in time for ${HABIT_LABELS[habit]}" />
`
```

**Action handler**:
```typescript
addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement
  const habit = target.id.replace('checkin-time-', '') as Habit
  const newTime = target.value  // "HH:MM" from native time picker
  const updated = setCheckInTime(appData, habit, newTime, todayLocalISO())
  // Trigger re-render
})
```

### New Action Function

**`src/ui/actions.ts`**:

```typescript
export function setCheckInTime(
  data: AppData,
  habit: Habit,
  time: string, // "HH:MM"
  nowISO: string
): AppData {
  return upsertConfig(data, {
    habit,
    motivationalText: data.config.find(c => c.habit === habit)?.motivationalText ?? '',
    checkInTime: time,
    updatedAt: nowISO,
  })
}

function getCheckInTime(data: AppData, habit: Habit): string {
  return data.config.find(c => c.habit === habit)?.checkInTime ?? '07:00'
}
```

### Integration with Screen Rendering

**`src/ui/viewmodel.ts`** — pass configured time to `checkinStatus()`:

```typescript
export function buildScreenModel(data: AppData, now: Date): ScreenModel {
  const todayISO = todayLocalISO(now)
  const habits = HABITS.map(habit => {
    const state = foldHabit(data.events, habit, todayISO)
    const configuredTime = getCheckInTime(data, habit)
    const status = checkinStatus(state, todayISO, now, configuredTime)
    return {
      habit,
      state,
      checkInStatus: status,
      // ...
    }
  })
  // ...
}
```

## System-Wide Impact

### Interaction Graph

1. **User sets check-in time in settings** → `setCheckInTime()` action → `upsertConfig()` appends/updates config → `now.toISOString()` stored as `updatedAt`
2. **App startup or render cycle** → `buildScreenModel()` calls `checkinStatus()` with injected `now` and `configuredTime`
3. **`checkinStatus()` logic** → compares current local hour against configured hour → determines if check-in prompt should show
4. **User completes check-in** → existing flow continues unchanged (appends `checkin` or `relapse` event) → `lastInteractionDate` updates to `todayISO`
5. **Next day after configured time** → `checkinStatus()` sees `lastInteractionDate < todayISO` and `now.getHours() >= configuredHour` → prompt reappears

### Error Propagation

- **Invalid time format**: HTML `<input type="time">` enforces `HH:MM` format — server-side validation not needed (PWA is client-only).
- **Time parse failure**: Fallback to `"07:00"` if `configuredTime` is malformed.
- **Midnight boundary edge case**: Test explicitly: user sets check-in to 23:00, checks in at 22:59 (should not suppress), then at 23:01 next day (should suppress from previous day).

### State Lifecycle Risks

- **Config updates are LWW**: If two devices update the time independently, last write wins by `updatedAt`. No conflict resolution needed (single user, eventual consistency acceptable).
- **Offline changes**: Config changes persist locally in `AppData.config[]` and sync via `dirtyEventIds[]` when network returns (existing pattern).
- **Clock skew**: Existing `clampFutureISO()` prevents backdated interactions from breaking check-in logic. A user setting their device clock forward, then checking in, will not break next day's prompt.

### API Surface Parity

**Affected interfaces**:
- `checkinStatus()` signature changes (adds optional `now` and `configuredTime` params) → backward compatible.
- `buildScreenModel()` now calls `checkinStatus()` with time info → internal change, no public API exposure.
- `HabitConfig` schema extends → LWW update strategy unchanged; migrations not needed (config is ephemeral, stored in AppData).

### Integration Test Scenarios

1. **Happy path: Check-in after configured time**
   - Set check-in time to 07:00
   - Simulate time at 07:01
   - Assert `checkinStatus()` returns 'standard' or 'catchup'
   - User answers check-in
   - Simulate time at 07:02 same day
   - Assert `checkinStatus()` returns 'none'

2. **Before configured time: No prompt**
   - Set check-in time to 07:00
   - Simulate time at 06:59
   - Assert `checkinStatus()` returns 'none'
   - Simulate time at 07:00 (exact boundary)
   - Assert `checkinStatus()` returns 'standard'

3. **Midnight boundary with late check-in time**
   - Set check-in time to 23:00
   - Day 1: User checks in at 23:30
   - Day 2 at 22:59: Assert no prompt (too early)
   - Day 2 at 23:01: Assert prompt appears (after configured time on new day)

4. **Catchup scenario with time threshold**
   - Set check-in time to 07:00
   - Simulate 3 days elapsed without check-in
   - Day 3 at 06:00: Assert 'none' (too early)
   - Day 3 at 07:00: Assert 'catchup' (2 days missed)
   - User answers catchup
   - Day 4 at 06:00: Assert 'none' (wait for 07:00)

5. **Config change mid-day**
   - Check-in time initially 07:00
   - Change to 15:00 at 10:00
   - Assert check-in prompt reappears (hasn't been answered yet, and we're past original time but not yet past new time)
   - ~~User answers~~ → system should not re-prompt if already answered today

## Acceptance Criteria

### Functional Requirements

- [ ] Add `checkInTime` field to `HabitConfig` schema
- [ ] Modify `checkinStatus()` function to accept `now` and `configuredTime` parameters
- [ ] Implement time-of-day comparison logic: check-in only shows if local hour >= configured hour
- [ ] Add time picker UI in settings modal for each habit (or globally if applying globally)
- [ ] Implement `setCheckInTime()` action following LWW config update pattern
- [ ] Default check-in time to 07:00 if not explicitly set
- [ ] Ensure backward compatibility: existing calls to `checkinStatus()` work without new parameters
- [ ] Validate time format: accept only "HH:MM" strings (HTML input enforces this)
- [ ] Update `buildScreenModel()` to pass configured time to `checkinStatus()`
- [ ] Sync config changes via existing dirtyEventIds mechanism

### Non-Functional Requirements

- [ ] All time logic uses device-local `now.getHours()` (no UTC, no timezone library)
- [ ] No migrations needed (config stored in AppData, not database schema)
- [ ] Performance: time comparison is O(1); no additional sorting or filtering
- [ ] Offline: works offline; syncs config changes when network returns

### Quality Gates

- [ ] All new functions have unit tests (TDD red-green)
- [ ] Integration test: end-to-end workflow of setting time and seeing prompt appear/disappear
- [ ] Edge case tests: midnight boundary, exact hour match, time after check-in answered
- [ ] No regression: existing check-in tests pass without modification
- [ ] TypeScript: no implicit `any` types; types for all new function signatures

## Success Metrics

- User can set a preferred check-in time in settings
- Check-in prompt appears only after the configured time each day
- Once answered, prompt doesn't reappear until after the configured time the next day
- Default (unconfigured) behaviour is 7:00 AM
- Settings change takes effect immediately on next app render cycle

## Dependencies & Risks

### Dependencies

- Existing `HabitConfig` LWW pattern and `upsertConfig()` infrastructure
- Existing time-injection pattern in fold logic (all time logic already accepts `now?: Date`)
- Existing settings UI modal and action despatch pattern

### Risks

**Travel / Timezone Change (Deferred)**
- **Risk**: User travels east/west and device timezone changes mid-day. Should the check-in logic snap to new timezone immediately, or continue in the original?
- **Current decision**: Deferred. Treat as future enhancement. For now, assume device timezone == user's intended check-in timezone.
- **Mitigation**: Document in settings that changing device timezone may cause check-in time to shift. Add ADR to `docs/decisions/` when travel plan is designed.

**Clock Skew**
- **Risk**: User sets device clock forward; check-in logic triggers prematurely.
- **Mitigation**: Existing `clampFutureISO()` handles forward-dated calendar days. Extend similar logic if needed: if device hour appears to jump forward mid-day, clamp check-in suppression to prevent double-prompt.

**Midnight Edge Case**
- **Risk**: User configures check-in time at 23:50, checks in at 23:55 on day 1. On day 2 at 00:05, should prompt reappear?
- **Test explicitly** (see integration test scenario 3 above).
- **Expected behaviour**: Yes, because calendar date changed and time threshold passed.

**Multi-Device Sync**
- **Risk**: Two devices set different check-in times; which wins?
- **Design**: LWW by `updatedAt` timestamp. Last device to update config wins.
- **Acceptable** for single user (no conflict in practice; users update settings on one device at a time).

## Implementation Phases

### Phase 1: Data Model & Logic (Foundation)

**Tasks:**
- [ ] Update `HabitConfig` interface to add `checkInTime?: string`
- [ ] Write unit tests for `checkinStatus()` with time-of-day logic (TDD red first)
  - Happy path: after configured time → standard/catchup
  - Before configured time → none
  - Exact hour boundary → standard/catchup
  - Catchup with time threshold
  - Already checked in today → none (regardless of time)
- [ ] Implement `checkinStatus()` changes
- [ ] Create `setCheckInTime()` action function
- [ ] Create `getCheckInTime()` helper (with "07:00" default)
- [ ] Verify all existing check-in tests still pass

**Success criteria:**
- All new tests pass (red-green TDD)
- No regression in existing test suite
- Time comparison logic is deterministic (accept `now?: Date`)

### Phase 2: UI & Integration (Implementation)

**Tasks:**
- [ ] Add time picker row to settings modal HTML in `src/ui/settings.ts`
- [ ] Wire time picker change event → `setCheckInTime()` action
- [ ] Update `buildScreenModel()` to pass `configuredTime` to `checkinStatus()`
- [ ] Write integration test: full flow of setting time and observing prompt behaviour
- [ ] Update `viewmodel.ts` if needed to handle time-aware check-in status

**Success criteria:**
- Time picker renders in settings
- Changing time immediately affects check-in prompt visibility
- Integration tests pass

### Phase 3: Edge Cases & Hardening (Polish)

**Tasks:**
- [ ] Add tests for midnight boundary (23:00 check-in time)
- [ ] Add tests for clock skew scenario (device time jumps forward)
- [ ] Add tests for config change mid-day
- [ ] Verify offline behaviour: config changes sync when network returns
- [ ] Update version to 0.4.0 and add CHANGELOG entry
- [ ] Document time-of-day behaviour in README or in-app help (if exists)

**Success criteria:**
- All edge case tests pass
- No new issues in full test suite
- CHANGELOG explains new feature with "What's new" and "Under the hood" sections
- Version bumped and displayed in footer

## Alternative Approaches Considered

### 1. **Per-Habit Check-In Times**
**Rejected**: User specified globally ("You should be able to customise when you want the question asked" — singular). Vape and drink both use same threshold for now. Can be extended per-habit in future if needed.

### 2. **Time Window Instead of Exact Time**
**Rejected**: User specified "Exact time" explicitly. A 30-minute window (07:00–07:30) would add complexity for minimal UX benefit.

### 3. **Timezone Selector UI**
**Rejected**: Deferred. Current architecture is device-local only. Adding timezone selection requires new infrastructure. Addressed in future travel plan.

### 4. **Web Push Notifications**
**Rejected**: Out of scope. No notification infrastructure currently exists. Current approach simply defers prompt until time threshold; no active push needed.

### 5. **Store Time as Minutes Since Midnight**
**Rejected**: ISO time string ("07:00") is more readable, easier to debug, and mirrors `recorded_at` format. Marginal storage/performance benefit from int not worth the readability cost.

## Future Considerations

### Timezone / Travel Plan

**When users cross timezones:**
- **Decision pending**: Should check-in time stay in original timezone (e.g., always 7 AM Sydney time even if user travels to London), or snap to device timezone?
- **Option A (snap)**: On travel, user's 7 AM becomes 7 AM London time immediately. Simpler to explain, but may disrupt habit rhythm.
- **Option B (pin)**: Store both local time and timezone offset; apply offset to current device timezone. More complex, but preserves intent.
- **Recommendation**: Defer decision until Jackie's travel patterns are known. For now, document: "Check-in time respects your device timezone. If you travel and change device timezone, check-in time will shift accordingly."
- **Follow-up task**: Create ADR in `docs/decisions/` with final decision + implementation plan.

### Multi-Habit Per-Habit Times

**Future scope**: If users want different check-in times for vape vs. drink (e.g., check vape at 7 AM, drink at 6 PM), extend config to store time per habit instead of globally.

### Notification Integration

**When notifications are added**: Extend check-in time logic to trigger a Web Push at configured time, rather than waiting for user to open app. This would require:
- Service worker enhancement
- Notification permission flow
- Schedule calculation considering device timezone

## Sources & References

### Technical References

- **Existing check-in logic**: `src/domain/fold.ts:67–81` (`checkinStatus()`)
- **Time utilities**: `src/domain/calendar.ts` (`todayLocalISO()`, `daysBetween()`, `isFriSatEvening()`)
- **Config update pattern**: `src/ui/actions.ts:59–71` (`upsertConfig()`, `setMotivation()`)
- **Settings UI pattern**: `src/ui/settings.ts:99–216` (modal structure, per-habit sections)
- **Test patterns**: `src/domain/fold.test.ts` (clock injection, TDD examples)

### Architectural Context

- **Requirements**: `docs/brainstorms/2026-07-07-sobriety-habit-tracker-requirements.md` (R5: local calendar-date day boundary)
- **Plan**: `docs/plans/2026-07-08-001-feat-sobriety-habit-tracker-pwa-plan.md` (Unit 1: data model, Unit 3: timing logic)
- **Timezone gotchas**: `docs/handoff/handoff.md:29` (CI tests timezone pinning to Sydney)

### Related Code

- **Event schema**: `src/domain/events.ts`
- **Config schema**: `src/store/schema.ts:6–10` (`HabitConfig`)
- **State folding**: `src/domain/fold.ts:4–11` (`HabitState`)
