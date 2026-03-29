# Garmin HangTracker Widget — Standalone Hang Timer

## Overview
A Connect IQ widget for FR255/955 that acts as a standalone hang timer. It does **not** communicate with the PWA — sessions are logged on the watch and the user registers them manually in the PWA afterwards.

Target hardware: **FR255/955 (Connect IQ 4.0)**

---

## Features

- **Configurable hang duration** — target time in seconds, adjustable on the watch (UP/DOWN, ±5s, range 5–120s)
- **Configurable delayed start** — countdown before timer starts (cycle through 0/3/5/10s via menu; 0 = instant start)
- **Timer with vibration** — buzzes at countdown ticks, at session start, at target reached (continues past target), and at stop
- **Session log** — every completed hang is logged with timestamp and duration; viewable on the watch

---

## File Structure

```
HangTrackerWidget/
  manifest.xml              — FR255/FR955 devices, minApiLevel 4.0.0
  monkey.jungle             — project build file
  resources/
    drawables/              — launcher icon XML
    images/                 — launcher icon PNG (40×40)
    strings/                — app name string resource
  source/
    HangTrackerApp.mc       — AppBase; loads/persists settings; creates SessionManager
    SessionManager.mc       — countdown, timer, vibration, session logging
    HangTrackerView.mc      — renders IDLE/COUNTDOWN/RUNNING/DONE; input delegate; menu
    LogView.mc              — scrollable session log view
```

---

## Data Model (Application.Storage)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `targetSec` | Number | 14 | Hang duration target (seconds) |
| `delaySec` | Number | 5 | Countdown delay before timer starts (0 = instant) |
| `sessionLog` | Array of `{ts, dur}` | `[]` | `ts` = Unix seconds, `dur` = duration in ms |

---

## UI / Navigation

### IDLE screen
Shows "HANG TIMER", target time (green), delay setting, and log count.

| Button | Action |
|--------|--------|
| **SELECT** | Start countdown (or immediate if delay=0) |
| **UP** | Increase target +5s (max 120s) |
| **DOWN** | Decrease target −5s (min 5s) |
| **MENU** (long-press UP) | Open settings/log menu |
| **BACK** | Exit widget |

### COUNTDOWN screen
Shows countdown number (`5… 4… 3… 2… 1…`) then "GO!" in yellow. Vibrates on each tick.

| Button | Action |
|--------|--------|
| **SELECT** | Cancel, return to IDLE |
| **BACK** | Cancel, return to IDLE |

### RUNNING screen
Shows elapsed time (e.g. `12.3`) in white, turns green when target is reached. Shows target reference and "STOP" prompt.

| Button | Action |
|--------|--------|
| **SELECT** | Stop timer, save session |
| **BACK** | Cancel without saving |

### DONE screen
Shows "Saved!" for 2 seconds, then returns to IDLE.

### Menu
Accessed via long-press UP on IDLE screen:
- **Delay: Ns** — cycles through 0/3/5/10 seconds
- **View Log** — pushes the log view
- **Clear Log** — deletes all logged sessions

### Log View
Shows recent sessions with date, time, and duration. UP/DOWN scrolls, BACK returns.

---

## Vibration Patterns

| Event | Pattern |
|-------|---------|
| Countdown start | Two short buzzes (100ms each) |
| Countdown tick | One 80ms buzz |
| Session start (GO!) | One firm 300ms buzz |
| Target reached | Two long buzzes (400ms each) |
| Session stopped | One 200ms buzz |

---

## Build & Deploy

See `HangTrackerWidget/Widget.md` for full build instructions.

Quick reference:
```bash
cd HangTrackerWidget
monkeyc -d fr255 -f monkey.jungle -o HangTracker.prg -y developer_key
connectiq                    # start simulator
monkeydo HangTracker.prg fr255   # run in simulator
```

Sideload: copy `HangTracker.prg` to `GARMIN/APPS/` on the watch via USB.
