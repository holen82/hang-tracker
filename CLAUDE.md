# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # Vitest unit tests (fast, no browser)
npm run test:e2e          # Playwright E2E tests (spins up serve on :3000)
npm run test:all          # Both suites sequentially

# Run a single unit test file
npx vitest run test/computeProgression.test.js

# Run a single E2E test by title
npx playwright test -g "test title"
```

No build step — the app is plain HTML/CSS/JS served directly.

## Architecture

**No framework, no bundler.** The app is a PWA that works entirely from static files.

- `lib.js` — ES module (the only one). Exports `DEFAULTS`, `LIMITS`, `dayKey`, `computeProgression`. Also assigns them to `window.*` so `app.js` can use them as globals. This dual-export pattern exists so Vitest can import the module directly without a browser.
- `app.js` — loaded via `defer`, uses `window.DEFAULTS` etc. from `lib.js`. Contains all DOM logic, timer state, settings UI, history rendering, voice commands, and backup/restore.
- `sw.js` — service worker. Cache key must be bumped on every release so users receive the update banner. Current pattern: `hang-vN`.
- `index.html` — structure only; no inline scripts or styles.
- `styles.css` — all styling.

**Data model** (localStorage keys):
- `hang_sessions_v1` — array of `{ ts, duration, level }` sorted by `ts`
- `hang_settings_v2` — flat object, merged with `DEFAULTS` on read
- `hang_state_v1` — `{ level }` (active level 1/2/3)
- `hang_cue_open_v1` — `'1'`/`'0'` (form cues panel state)

**Progression engine** (`computeProgression` in `lib.js`):
- Per-level and independent. Counts qualifying days (days with ≥ `minHangsPerDay` sessions) up to but excluding today.
- Every `daysPerStep` qualifying days earns `+stepSec` to the target.
- Consecutive missed days beyond `graceDays` each apply a `penaltySec` deduction (floored at `startVal`).
- Partial days (sessions > 0 but < `minHangsPerDay`) are neutral — no penalty, no qual.

**Settings** (`DEFAULTS` / `LIMITS` in `lib.js`):
- Numeric settings use `adj(key, delta)` + `LIMITS[key]` bounds.
- Boolean settings use dedicated toggle functions (e.g. `toggleAutoStop()`).
- `renderSettings()` iterates `Object.keys(DEFAULTS)` to update `sv-{key}` elements.

**Timer split-button**: `#tap-btn-wrap` contains `#tap-btn` (main, flex:1) and `#tap-delay` (62 px right segment). Level 3 always hides `#tap-delay`. Countdown state: `countdownActive`, `countdownTimer`.

## When to write tests

Unit tests live in `test/computeProgression.test.js` and target `lib.js` only.

Write a unit test when: logic inside `computeProgression` changes, `DEFAULTS`/`LIMITS` values change (check existing expectations), or a new pure function is added to `lib.js`.

Do **not** write unit tests for: CSS, DOM manipulation, timer display, service worker, toast/banner/heatmap rendering, settings UI, or anything in `app.js`.

## Workflow rules

- Bump `CACHE` in `sw.js` (`hang-vN` → `hang-v(N+1)`) after any code change, unless `sw.js` is already modified in the same commit batch.
- Commit directly to `master`. CI runs unit + e2e jobs; deploy to GitHub Pages only happens when both pass.
