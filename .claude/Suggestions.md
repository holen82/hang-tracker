# Hang Tracker — Improvement Suggestions

Compiled from GtG methodology and gamification design expert reviews (2026-03-16).

---

## Tier 1 — Quick Wins

| # | Task | Source | Description |
|---|---|---|---|
| 6 | **Anticipation label on timer screen** | Gamification | When `nextStepIn <= 3`, show a muted line under the target label: "2 more days to +2s". Dopamine fires on anticipation |
| 7 | **GtG intro on Guide screen** | GtG | Add a brief paragraph at the top: "This app uses Grease the Groove — frequent, easy practice. Each session should feel comfortable. Never push to failure." |

## Tier 2 — Medium Effort, High Value

| # | Task | Source | Description |
|---|---|---|---|
| 9 | **Next-set spacing suggestion** | GtG | After saving, show "Next set in ~1h" or "Ready for another" based on elapsed time since last session. Reinforces GtG's distributed practice |
| 10 | **Session save animation** | Gamification | CSS pulse/glow on today-bar fill when saving. Brief ring scale pulse when target is reached. Sub-500ms visual confirmation, pure CSS |
| 11 | **Journey summary on timer screen** | Gamification | Show "8s → 14s in 21 days" beneath the streak — at-a-glance macro progress without leaving the main screen |
| 12 | **Weekly mini-summary on Log** | Both | Card at top of Log: qualifying days this week, total sessions, comparison to last week ("2 more sessions than last week") |
| 13 | **Endowed progress effect** | Gamification | Today-bar at 0 sessions: show 5% width with dim fill. Progression bar: frame as "Day 1 of 7" not "0 / 7" |
| 14 | **Vary "Nice work!" message** | Gamification | Rotate through "Nice work!", "Solid hang.", "Logged.", "Done." to prevent phrase-blindness |
| 15 | **Total hang time stat** | Gamification | Add "Total Hang Time" to Log stats (sum all L1+L2 durations). Makes accumulated investment tangible |

## Tier 3 — Larger Features

| # | Task | Source | Description |
|---|---|---|---|
| 16 | **Lightweight badge system** | Gamification | 5-8 badges in localStorage: "7-Day Streak", "First Level Up", "New PR", "Tried All Levels", etc. Toast on unlock, display on Log |
| 17 | **Session spacing awareness** | GtG | Only count sessions toward daily target if >=15min apart, or display a "spread score". Clustered sessions miss GtG's distributed practice benefit |
| 18 | **Form quality toggle** | GtG | Optional single-tap "form check" in post-timer (checkmark vs warning). Store as boolean on session. Supports "perfect practice only" |
| 19 | **Cycle / periodization support** | GtG | Optional cycle feature: start date + length (default 6 weeks). Show "Week 3 of 6" in progression card. Prompt max test + deload at cycle end |
| 20 | **Variable surprise messages** | Gamification | ~1 in 5 saves, show a data-driven fun fact: "You've logged 50 sessions" / "Average hang is 3.2s longer than when you started" |
| 21 | **Overtraining soft cap** | GtG | Toast warning at 11+ sessions/day: "Consider resting until tomorrow." Also warn when session duration exceeds 150% of target |
| 22 | **Wave loading** | GtG | Optional setting to vary daily session target (high/medium/low cycling) to manage cumulative fatigue |
| 23 | **Onboarding overlay** | Gamification | One-time 3-panel welcome for new users: "Hang. Tap Start." -> "Twice a day to qualify" -> "Your target grows automatically" |
| 24 | **Level-up celebration** | Gamification | Replace plain toast with a brief full-width overlay in the new level's color: "You earned this. Passive hang mastered." Auto-dismiss after 3s |
| 25 | **Max test feature** | GtG | "Test Max" button that records a flagged session. Show current target as % of max. GtG trains at 40-50% of max |
| 26 | **Reminder notifications** | GtG | Optional Notification API reminders every N hours (1-3h configurable). Uses existing service worker |
| 27 | **Contextual daily greeting** | Gamification | When 0 sessions today: show "Day 15 — keep building" (on streak) or "Rest days are part of the process" (returning after miss) |
| 28 | **Personal goal field** | Gamification | Optional user-defined goal ("My goal: 30s passive hang") with progress % shown on timer screen |
| 29 | **Projected date** | GtG | In progression card: "At current pace, next step in ~X days" based on recent qualifying frequency |
| 30 | **Warm-up cue** | GtG | Add to form cues: "If cold, do 5-10 wrist circles and arm swings first" |
