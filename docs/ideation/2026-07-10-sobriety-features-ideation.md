---
date: 2026-07-10
topic: sobriety-feature-enhancements
focus: behavioural-psychology-relapse-prevention-drinking-smoking
---

# Ideation: HabitTracker Feature Enhancement Set

## Codebase Context

**Project:** HabitTracker v0.3.4 — Single-user sobriety PWA with vape + drink counters, event-sourced architecture, local-first offline capability, Supabase sync on shared WLC project.

**Current Capabilities:**
- Dual counters (days clean from vaping, drinking)
- Daily/catch-up check-in prompts with relapse date-picker
- Milestone celebrations (1, 7, 30, 60, 90, 180, 270, 365+ days)
- Editable motivational text per habit
- Settings: correct start date, undo last relapse, sign out
- Weekend support messaging ("made it through Fri/Sat")
- Event-sourced state model (append-only: start, checkin, relapse, revoke events)
- Pure fold logic over event log for conflict-free sync

**Architecture Strengths:**
- Append-only events eliminate sync conflicts
- Pure fold for state derivation = predictable, testable
- localStorage + Supabase union-by-id = offline-capable with cloud backup
- One-time email OTP per device (iOS PWA storage-partition friendly)

**Known Constraints:**
- Single-user only (multi-user features deferred; sharing WLC Supabase project with 2/hr email limit)
- No notification infrastructure yet (Web Push not wired)
- No analytics dashboard or data visualisation layer
- Quick setup/onboarding UI still in dev
- Custom domain pending DNS propagation (habits.parnellsystems.com)

## Ranked Ideas

### 1. **Lapse-to-Relapse Blocker**
**Description:** After a user logs a slip event, the app enters a focused "post-lapse mode" for 24 hours: daily check-in prompts are mandatory (not optional), messaging is shame-free and recovery-focused ("You slipped. Let's restart together."), and the check-in prompt includes a quick reflexion question ("What happened? What can you do differently tomorrow?"). If the user completes 24 hours of check-ins without another slip, the mode exits and regular cadence resumes.

**Rationale:** Relapse-prevention science shows the critical intervention window is immediately after a lapse. Many users escalate from one slip to a full relapse within 24–48 hours; structured micro-engagement with shame-free framing interrupts that spiral. This is the highest-impact prevention feature because it targets the state-machine transition most likely to cause harm.

**Downsides:** 
- Requires state-machine logic (detecting lapse, tracking 24-hour countdown, enforcing daily cadence)
- UI complexity: different prompt styling/messaging during post-lapse mode
- Risk of user frustration if mode feels punitive; requires careful tone in messaging

**Confidence:** 92% | **Complexity:** High | **Ship Window:** Phase 2 (2–4w)

**Implementation Hook:** Add `event.type: 'lapse'` (distinct from relapse), or use domain logic to detect "most recent event is relapse within last 24h". Track countdown in device state (separate from events). Conditional UI in render.ts for post-lapse prompts.

---

### 2. **High-Risk Window Alerts**
**Description:** Analyse slip/relapse event timestamps to identify the user's personal "danger hours" (e.g., Fridays 6–8pm, or Monday mornings). Once a pattern is detected (≥2 slips in same hour-of-day + day-of-week combination), surface a predictive alert 30 minutes before that window. Alert includes a coping protocol: "You typically slip around now. Try: [breathing / call sponsor / go for a walk]."

**Rationale:** Prevention is strongest when predictive. Personalised timing alerts let users proactively deploy coping strategies before urges strike. Much more effective than generic reminders because it's keyed to the user's own vulnerabilities.

**Downsides:**
- Requires Web Push notification infrastructure (not yet wired)
- Time-series analysis of slip patterns; low signal if user has <3 slips
- Needs timezone awareness to predict correctly
- Risk of false alerts creating alert fatigue

**Confidence:** 88% | **Complexity:** Low | **Ship Window:** Phase 1 (<2w) for pattern detection logic; Phase 2 for notification wiring

**Implementation Hook:** New domain module `riskWindows.ts` analyses `relapse` events by hour-of-day + day-of-week via pure fold. Detective function returns high-risk windows (with confidence). Store in device state. Notification layer calls detective at check-in time.

---

### 3. **1-Tap Slip Logging**
**Description:** Replace the current date-picker flow for relapse logging with a quick-select grid: "Today", "Yesterday", "2 days ago", "3–7 days ago" as large buttons, plus a fallback "Pick exact date" for older slips. Cutting 30-second date-picker friction down to 5-second button tap.

**Rationale:** In a crisis moment (immediate urge, slip just happened), friction kills both data capture and intervention speed. Every second delayed = lost opportunity to surface support. This is a pure UX win with zero architectural change; it increases data capture + enables faster response.

**Downsides:**
- None structural (pure polish)
- Only addresses friction, not prevention directly

**Confidence:** 95% | **Complexity:** Low | **Ship Window:** Phase 1 (<2w)

**Implementation Hook:** Modify `openRelapseSheet()` in render.ts or create new `quickRelapseEntry()` path. Buttons compute dates (today, yesterday, etc.) locally. Fallback to existing date-picker only if user selects "exact date".

---

### 4. **Personal Risk Profile**
**Description:** Generate a personalised risk insight card from slip clustering: "Your last 3 relapses happened on Fridays, 2–5pm — consider scheduling a coping activity then" or "You slip after stressful work days — take a 10-minute break at 5pm." Built from templated pattern matching over `recorded_at` and optional slip-context tags (see idea #6).

**Rationale:** Generic advice doesn't stick; personalisation makes prevention actionable. A profile card surfaces the user's own vulnerabilities + suggests concrete mitigations grounded in their history. Feeds into alerting and coping suggestions.

**Downsides:**
- Requires pattern-matching logic (temporal clustering, optional NLP/templating)
- Needs sufficient slip history (≥3 relapses) to be meaningful
- False positives if relapses are scattered (no clear pattern)

**Confidence:** 85% | **Complexity:** Medium | **Ship Window:** Phase 2 (2–4w)

**Implementation Hook:** New domain module `riskProfile.ts` clusters relapse events by time/context. Returns structured data (day, hour, trigger). Template engine renders as insight card. Display in home screen or settings.

---

### 5. **Coping Tool Quick-Access Overlay**
**Description:** Swipe-up action menu accessible from the home screen (or tap a "SOS" button). Four quick actions: (1) 4-minute guided breathing timer (inline), (2) open distraction playlist (link to Spotify/YouTube), (3) call-sponsor shortcut (triggers phone call via tel: link), (4) message accountability partner (when paired, Phase 2). Reduces in-the-moment decision fatigue.

**Rationale:** During active urge, cognitive load is high; accessibility to coping tools matters. One-tap access to grounding techniques (breathing) + distraction + social support = strong intervention. Leverages PWA capability to link to phone actions.

**Downsides:**
- Requires linking to external services (Spotify, phone) or building timer UX
- "Accountability partner" action only works in multi-user future
- Risk that tool becomes unused if not contextually relevant to user's triggers

**Confidence:** 82% | **Complexity:** Medium | **Ship Window:** Phase 1–2 (1–3w) for basic version; Phase 2 for full feature

**Implementation Hook:** Add `.sos-overlay` component to render.ts. Breathing timer built with Web Animation or simple setInterval. External links via `<a href="tel:" />` and `<a href="spotify://..." />`. Quick-access button on home card.

---

### 6. **Context-Triggered Coping Playbook**
**Description:** When logging a relapse, user tags the context ("Stressed", "Lonely", "Bored", "Social pressure", "Tired"). Over time, the app learns which coping strategies (from a library of ~15 techniques) correlate with successful recovery after each trigger. When that trigger is detected in future check-ins or alerts, the app suggests the strategy that worked before: "You mentioned stress. Last time stress hit, breathing + calling Sarah worked. Try that again."

**Rationale:** One-size-fits-all coping advice fails. Relapse science shows efficacy when strategies match the user's trigger type. By indexing past successes to current situations, the app becomes a personalised coach. This transforms coping from generic to adaptive.

**Downsides:**
- Requires slip-context tagging UI (dropdown, tag selection at relapse time)
- Builds on idea #4 (risk profile); needs sufficient trigger history
- Strategy library requires curation + testing
- Complex fold logic to correlate triggers → strategies → outcomes

**Confidence:** 79% | **Complexity:** High | **Ship Window:** Phase 2 (2–4w)

**Implementation Hook:** New event type `relapse { context: 'stressed' | 'lonely' | ... }`. Domain logic correlates relapse→recovery patterns. Trigger-stratified strategy suggestions in check-in prompts. Coping library stored in config or as static data.

---

### 7. **Relapse Escalation Chain Detector**
**Description:** Track relapse frequency trend: if user logs 2–3 relapses within 7 days (a "relapse cycle" vs. single slip + recovery), surface a gentle alert: "I'm seeing a pattern — you've slipped 3 times this week. This is hard. Let's talk about getting more support." Suggest next steps: call sponsor, reach out to counsellor, adjust motivational text, review settings.

**Rationale:** Single slips are normal; relapse *cycles* signal deeper struggle. Early detection of this pattern allows intervention (escalation to sponsor/counsellor) before it becomes entrenched. Prevents the spiral from locking in.

**Downsides:**
- Sensitive to false positives if recovery is genuinely messy (slip, recover, slip again within days can be normal)
- Requires tuning threshold (2 vs. 3 slips in 7 days?)
- Message tone must be supportive, not alarming

**Confidence:** 80% | **Complexity:** Medium | **Ship Window:** Phase 1–2 (1–3w)

**Implementation Hook:** New domain detector `escalationChain()` counts relapses in rolling 7-day window. Triggers if count ≥2. Surfaces in-app notification + optional email alert. Links to action buttons (sponsor, settings review).

---

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|---|
| 1 | Share-to-Accountability Partner | Single-user app has no accountability partner to share with; multi-user feature, deferred. |
| 2 | Substitution Habit Tracker | Medium complexity (new event type + UI + analytics) for modest value; supporting behaviour, not core prevention. |
| 3 | Accountability Partner Streaks | Requires multi-user peer network; not in scope for single-user v0.3. |
| 4 | Milestone Witness Gallery | "Witness" requires audience; social layer not in scope. |
| 5 | Regional Sobriety Leaderboard | Cross-user aggregation + privacy controls not in scope; over-engineered. |
| 6 | Peer Check-In Prompts | Requires accountability partner roster; multi-user only. |
| 7 | Moderated Support Messages Board | Requires community infrastructure + moderation; defer to v1 multi-user. |
| 8 | Achievement Badge Sharing | Cosmetic feature; sharing to whom? No audience in single-user context. |
| 9 | Streak Promise Wall | Implies social viewing; multi-user feature. |
| 10 | Accountability Partner Pairing (In-App Matching) | Matchmaking + profile storage + privacy controls; multi-user infrastructure not ready. |
| 11 | QR-Code Device Pairing | Multi-device sync infrastructure not in place; login via email is simpler. |
| 12 | Offline-First Action Queue | Sync reliability goal, but Phase 1 core already handles offline; defer to Phase 2 hardening. |
| 13 | Urge Intensity Micro-Log | Micro-logging of urge data narrowly subsumed by Context-Triggered Playbook. |
| 14 | Relapse Velocity Early Warning | Acceleration detection covered more precisely by Relapse Escalation Chain. |
| 15 | Vulnerability Heatmap | Temporal visualisation less actionable than Personal Risk Profile's personalisation + branching. |
| 16 | Milestone Vulnerability Window | Post-milestone risk alert redundant with High-Risk Window Alerts' generalised detection. |
| 17 | Home Screen Shortcuts | UX polish; prevention features take priority; Phase 2 speed pass. |
| 18 | Motivational Prompt Templates | Static templates subsumed by Context-Triggered Playbook's adaptive logic. |
| 19 | Recovery Speed Index | Motivational metric after-the-fact; not prevention-focused; Phase 2 polish. |
| 20 | Smart Timezone-Aware Push Notifications | Infrastructure concern (when/not-when to alert); Phase 2 notifications work. |
| 21 | Milestone Cliff Risk | Statistical edge case; lower prevention specificity than Escalation Chain. |
| 22 | Persistent Sync Status Dot | Operational UX (reassurance); does not prevent relapse; Phase 2 trust-building. |
| 23 | Streak Burndown Rate | Motivational trend; early-warning capability < High-Risk Window Alerts. |
| 24 | Streak Longevity Trend | Motivational dashboard metric; Phase 2 analytics; not prevention. |
| 25 | Catchup vs Daily Adherence | Behavioural comparison for motivation; no direct prevention pathway; Phase 2. |

---

## Implementation Roadmap

**Phase 1 (Weeks 1–2) — Immediate Prevention Wins:**
- 1-Tap Slip Logging (quick UX friction kill)
- High-Risk Window Alerts (detection logic only; notification wiring in Phase 2)
- Relapse Escalation Chain Detector (pattern detection + in-app alert)
- Coping Tool Quick-Access Overlay (basic version: breathing timer + distraction link)

**Phase 2 (Weeks 2–4) — Adaptive Coaching Layer:**
- Lapse-to-Relapse Blocker (state machine + shame-free mode)
- Personal Risk Profile (pattern generation + card UI)
- Context-Triggered Coping Playbook (trigger tagging + strategy correlation)
- High-Risk Window Alerts (Web Push notification wiring)
- Coping Tool overlay (full version: accountability partner action)

**Multi-User Roadmap (Post v0.3.4, gated on Jackie onboarding):**
- Accountability Partner Streaks (view friend's count + check-ins)
- Milestone Witness Gallery (shareable milestone card)
- Peer Check-In Prompts (lightweight mutual accountability)
- Moderated Support Board (anonymous peer messages)

---

## Session Log

- **2026-07-10 AEST:** Initial ideation (v0.3.4 freeze-frame). Grounding scan completed. 32 raw ideas generated across 4 frames (relapse prevention, social/accountability, analytics, friction reduction). Critique filtered 11 ideas (mostly multi-user social features). 21 survivors ranked; top 7 selected by weighted score (40% prevention impact, 30% pragmatism, 10% each for friction/novelty/leverage). Ideation document written and committed to `docs/ideation/`. Ready for brainstorm handoff on selected ideas.

---

## Next Steps

- **Brainstorm:** Select any idea (e.g., Lapse-to-Relapse Blocker) for deep design work (UX, data model, edge cases)
- **Phase 1 execution:** Start with 1-Tap Slip Logging (1–2 days), escalate to High-Risk Window Alerts (pattern detection logic)
- **Defer:** Multi-user features gated on v0.3.5 + Jackie onboarding + custom domain live
