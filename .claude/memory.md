# Hang Tracker — Project Memory

## What this is
A single-file PWA (`index.html`) for tracking a pull-up training program using the **Greasing the Groove (GtG)** methodology. Hosted on GitHub Pages. The user is working toward their first pull-up by consistently doing micro workouts.

## Live file
`index.html` in the repo root. GitHub Pages serves it at:
`https://holen82.github.io/hang-tracker/`

## GtG methodology (core training philosophy)
- Coined by Pavel Tsatsouline — strength as a skill trained neurologically
- Multiple micro-sessions per day (2–3) at 40–50% effort, **never to fatigue**
- One set per visit, always. Never train through soreness.
- Progress trigger = "this feels too easy", not a calendar date
- Focus on ONE movement only per level

## Training progression (3 levels)
| Level | Exercise | What timer tracks | Resets to |
|---|---|---|---|
| 1 | Passive dead hang | Hold duration (seconds) | 8s |
| 2 | Active hang | Hold duration (seconds) | 5s |
| 3 | Scapular shrugs | Rep count | 1 rep |

- **L1 → L2 suggestion** triggers at 30s target (configurable)
- **L2 → L3 suggestion** triggers at 20s target (configurable)
- Level-up is **suggested** (app recommends, user confirms), never automatic
- Each level has **independent progression** — switching levels doesn't affect others

## App architecture
- Single HTML file, vanilla JS, no frameworks, no build step
- All data in `localStorage` (3 keys: `hang_sessions_v1`, `hang_settings_v2`, `hang_state_v1`)
- Installable as Android PWA via Chrome "Add to Home Screen"
- Fonts: Bebas Neue (timer digits), Syne (headings/buttons), DM Mono (body/labels)

## Data structures
```js
// Session
{ ts: Date.now(), duration: Number, level: 1|2|3 }
// duration = milliseconds for L1/L2, raw rep count for L3

// Settings (with defaults)
{
  startSecL1: 8, startSecL2: 5, startRepsL3: 1,
  stepSec: 2, daysPerStep: 7, minHangsPerDay: 2,
  graceDays: 1, penaltySec: 2,
  levelupThreshL1: 30, levelupThreshL2: 20
}

// State
{ level: 1|2|3, levelupDismissed: boolean }
```

## Key functions
- `computeProgression(sessions, settings, level)` — walks calendar days from first session, counts qualifying days (≥ minHangsPerDay), applies miss penalties, returns `{ targetVal, qualDays, daysIntoStep, nextStepIn }`
- `refreshTimerUI()` — recalculates progression, updates ring/rep counter, today bar, level badge, level-up banner
- `applyLevelTheme(lvl)` — switches colors (L1=green #c8f542, L2=cyan #42d4f5, L3=pink #f542c8), shows/hides ring vs rep counter
- `checkLevelUpSuggestion()` — shows banner if target ≥ threshold and not dismissed
- `downloadBackup()` / `restoreBackup(event)` — JSON export/import of all data

## Tabs
1. **Timer** — ring timer (L1/L2) or rep counter (L3), today progress bar, voice control (say "go"/"stop"), level badge, level-up banner
2. **Log** — stats (target/streak/best), GitHub-style heatmap (15 weeks), session list with inline edit/delete, manual add with backdating
3. **Settings** — progression card, manual level switch, all constants adjustable, backup & restore
4. **Guide** — written instructions for all 3 levels with form cues and common mistakes

## Visual details
- Dark theme: bg `#0a0a0a`, surface `#141414`, accent `#c8f542`
- Ring: fills to target (accent color), turns white when over target, red overflow ring starts
- Today bar: grey → orange (partial) → green (on target) → white + "✦ bonus" (3+ sessions)
- Heatmap cells: dark red (missed), dark green (1), medium green (2), bright accent (≥ min), white (bonus/3+)
- Session dots in log are color-coded by level

## Backup format
```json
{
  "version": 1,
  "exportedAt": "ISO string",
  "sessions": [...],
  "settings": {...},
  "state": {...}
}
```
File named `hang-backup-YYYY-MM-DD.json`. Future plan: replace with online backup service (same JSON shape, POST to backend).

## Known decisions / preferences
- User is on Android, primary usage on phone
- Voice control included (Web Speech API, "go" / "stop")
- Bebas Neue chosen for timer digits specifically because it has uniform-height lining figures (no old-style numeral jumping)
- Level-up dismissal is per-session-state — resets if user manually switches level
- Heatmap counts ALL sessions regardless of level (cross-level activity view)
- Stats row (target/streak/best) filters to CURRENT level only