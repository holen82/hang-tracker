# Hang Tracker — Backlog

Items evaluated but deferred. Ordered roughly by priority.

### #1 — Heatmap overflow on very large session counts
Long-time users with 100+ sessions per day (edge case) can cause the heatmap cell to overflow its container. Cap the visual intensity at a sensible maximum rather than letting it grow unbounded.

### #2 — Log edit: missing level validation
`confirmAddSession()` accepts any numeric `level` value typed into the edit form. Clamp or validate to `{1, 2, 3}` before saving.

### #3 — Settings persistence on import: unknown keys not stripped
When a backup is restored, `{...DEFAULTS, ...data.settings}` spreads all keys from `data.settings` — including any obsolete or unknown keys from older versions. Strip keys not present in `DEFAULTS` before saving.

### #4 — Service worker: stale update banner on back-navigation
If the user navigates away and returns, the update banner may re-appear even after the SW has already been updated. Track banner-shown state to suppress duplicate prompts.

### #5 — Countdown cancel on app visibility change
If the phone screen turns off during a countdown, the countdown keeps running silently. Consider pausing or cancelling countdown on `visibilitychange` hidden.

### #6 — Export filename includes timezone offset
`exportBackup()` builds the filename from `new Date().toISOString()` which uses UTC. Local date might differ from displayed date. Use a local-date string for the filename.

### #7 — Log: delete confirmation is browser `confirm()`
On iOS PWA, `window.confirm()` is sometimes blocked or unstyled. Replace with an in-app confirmation UI consistent with the rest of the app.

### #8 — Settings: `adj()` does not handle non-finite values
If localStorage contains `Infinity` or `NaN` for a numeric setting, `adj()` will silently propagate it. Add a `Number.isFinite` guard after clamping.

### #9 — `computeProgression` called redundantly on every tick
`tick()` calls `refreshTimerUI()` which recomputes progression every second. Cache the result and recompute only when sessions or settings change.

### #10 — No scroll restoration on tab switch
Switching tabs (Timer → Log → Stats) doesn't reset scroll position. Users land mid-page after switching. Reset `scrollTop` to 0 on tab activation.

### #11 — Heatmap: no empty-state message
When there are zero sessions the heatmap renders an empty grid with no explanatory text. Show a brief "No sessions yet" prompt.

### #12 — Per-session notes field
Allow users to attach a short text note to each session (e.g. "grip fatigue", "good day"). Stored in the session object as optional `note` string.

### #13 — Streak counter
Display the current consecutive-day streak on the Stats tab. Motivational feature; derivable from existing session data.