# Garmin Forerunner Watch Integration — Serverless BLE Plan (Revised)

## Context
The user wants to use the watch **standalone** — start hangs, time them, and receive vibration feedback without the phone/PWA being open. Sessions accumulate on the watch and are synced to the PWA the next time it's opened. No server required.

**Core constraint: The watch is the primary actor. The phone syncs retrospectively.**

Target hardware: **FR255/955 (Connect IQ 4.0)** + **Android Chrome**

---

## Architecture Overview

```
┌──────────────────────────┐    ← gym: no phone needed →    ┌──────────────────────────┐
│   Garmin FR255/955        │                                │   PWA (Android Chrome)   │
│   Connect IQ Widget       │    ← later, when app opens →  │   Web Bluetooth API      │
│                           │ ◄──────────────────────────► │                           │
│  Application.Storage:     │  TARGET_CHAR (R/W)         ◄── │  writes computed target  │
│   • targetSec             │  LEVEL_CHAR  (R/W)         ◄── │  writes current level    │
│   • level                 │  SESSIONS_CHAR (Read)      ──► │  reads pending sessions  │
│   • pendingSessions[]     │  COMMAND_CHAR  (Write)     ◄── │  sends CLEAR command     │
└──────────────────────────┘                                └──────────────────────────┘
```

### Two independent flows

**Gym flow (watch only, no phone):**
1. Watch boots → loads `targetSec` + `level` from `Application.Storage`
2. User presses ACTION → 5-second countdown with vibration
3. Timer runs → buzzes at target, continues
4. User presses ACTION again → session stored in `Application.Storage.pendingSessions`

**Sync flow (when PWA opens):**
1. PWA auto-reconnects to previously paired watch (`navigator.bluetooth.getDevices()`)
2. Writes current `targetSec` + `level` (computed fresh from `computeProgression`)
3. Reads `SESSIONS_CHAR` → parses pending sessions → logs them to localStorage
4. Writes `0x03` (CLEAR_SESSIONS) to `COMMAND_CHAR`
5. Shows toast: "3 sessions synced from watch"

---

## Part 1: Connect IQ App (Monkey C) — Watch Side

### File structure
```
HangTrackerWidget/
  manifest.xml          — BLE + Sensor permissions, minApiLevel="4.0.0", fr255/fr955
  source/
    HangTrackerApp.mc   — AppBase; BLE setup; loads persistent storage on boot
    BleDelegate.mc      — BleDelegate; serves characteristics; handles COMMAND writes
    SessionManager.mc   — countdown (5s), timer, vibration, stores session on stop
    HangTrackerView.mc  — renders IDLE/COUNTDOWN/RUNNING/DONE; ACTION key = start/stop
```

### GATT Service UUIDs
```
Service:         12ab3456-7890-cdef-0123-456789abcdef
TARGET_CHAR:     12ab3456-0001-cdef-0123-456789abcdef  Read+Write, 2 bytes uint16 LE (seconds)
LEVEL_CHAR:      12ab3456-0002-cdef-0123-456789abcdef  Read+Write, 1 byte uint8 (1/2/3)
SESSIONS_CHAR:   12ab3456-0003-cdef-0123-456789abcdef  Read, up to 512 bytes (9 bytes × N sessions)
COMMAND_CHAR:    12ab3456-0004-cdef-0123-456789abcdef  Write Without Response, 1 byte
```

Commands: `0x01` = start session (phone-triggered), `0x02` = cancel, `0x03` = clear sessions

### Session binary encoding (9 bytes each)
```
Bytes 0–3: uint32 LE — Unix timestamp in seconds (ts / 1000 from JS)
Bytes 4–7: uint32 LE — duration in ms (L1/L2) or rep count (L3)
Byte  8:   uint8    — level (1, 2, or 3)
```
512 bytes ÷ 9 = 56 sessions max per sync. More than sufficient for daily use.

### HangTrackerApp.mc — Application class
- On `onStart()`: load `targetSec` and `level` from `Application.Storage` (defaults: 14, 1)
- Register BLE service with all 4 characteristics
- Start advertising as "HangTracker"
- Instantiate `BleDelegate` and `SessionManager`

### BleDelegate.mc — GATT event handling
- `onCharacteristicRead(TARGET_CHAR)` → return current `targetSec` as uint16 LE
- `onCharacteristicRead(LEVEL_CHAR)` → return current `level` as uint8
- `onCharacteristicRead(SESSIONS_CHAR)` → serialize `pendingSessions` array to 9-byte-per-session binary
- `onCharacteristicWrite(TARGET_CHAR, value)` → update `targetSec`, persist to `Application.Storage`
- `onCharacteristicWrite(LEVEL_CHAR, value)` → update `level`, persist
- `onCharacteristicWrite(COMMAND_CHAR, value)`:
  - `0x01` → `sessionMgr.startCountdown()`
  - `0x02` → `sessionMgr.cancel()`
  - `0x03` → clear `pendingSessions`, persist

### SessionManager.mc — Countdown, timer, vibration
- `startCountdown()`: 5-second countdown timer (1s tick), vibrations below
- `stopSession()`: records `{ts: Time.now().value(), durationMs, level}` to `pendingSessions`, persists
- Vibration patterns:
  - Countdown start: two short buzzes (100ms each)
  - Each countdown tick: one 80ms buzz
  - Session start (0): one firm 300ms buzz
  - Target hit: two long buzzes (400ms each), timer continues
  - Session stopped: one 200ms buzz

### HangTrackerView.mc — Display
- IDLE: shows "READY", current level name, target (e.g. "14s")
- COUNTDOWN: shows "3… 2… 1…" or "GO!"
- RUNNING: shows elapsed seconds, target reference, "● STOP" prompt
- DONE: briefly shows "Saved!" then returns to IDLE

---

## Part 2: PWA Changes

### New file: `ble.js`
Loaded via `<script defer src="ble.js">` after `app.js`. Uses `window.*` globals from `lib.js` and `app.js`.

```js
// UUIDs (must match manifest exactly)
const SERVICE_UUID   = '12ab3456-7890-cdef-0123-456789abcdef';
const TARGET_CHAR    = '12ab3456-0001-cdef-0123-456789abcdef';
const LEVEL_CHAR     = '12ab3456-0002-cdef-0123-456789abcdef';
const SESSIONS_CHAR  = '12ab3456-0003-cdef-0123-456789abcdef';
const COMMAND_CHAR   = '12ab3456-0004-cdef-0123-456789abcdef';
```

**Key functions:**
```js
async bleInit()             // on PWA load: try auto-reconnect via getDevices()
async bleConnect()          // manual pair: requestDevice() → connect → sync → drain
async bleSyncTarget()       // computes target via computeProgression(), writes TARGET + LEVEL
async bleDrainSessions()    // reads SESSIONS_CHAR, parses binary, logs new sessions, sends CLEAR
      bleIsConnected()      // returns _server?.connected
```

**`bleDrainSessions()` detail:**
```js
async function bleDrainSessions() {
  const buf = await _chars.sessions.readValue();        // ArrayBuffer
  const view = new DataView(buf);
  const count = buf.byteLength / 9;
  const existing = new Set(getSessions().map(s => s.ts));
  let newCount = 0;
  for (let i = 0; i < count; i++) {
    const tsSec  = view.getUint32(i * 9,     true);    // seconds
    const durMs  = view.getUint32(i * 9 + 4, true);    // ms or reps
    const level  = view.getUint8 (i * 9 + 8);
    const ts     = tsSec * 1000;
    if (!existing.has(ts)) {
      getSessions().push({ ts, duration: durMs, level });
      newCount++;
    }
  }
  if (newCount > 0) {
    saveSessions(getSessions());                         // sorts + persists
    renderHistory();                                     // refresh UI
    showToast(`${newCount} session${newCount > 1 ? 's' : ''} synced from watch`);
  }
  // Clear watch queue
  await _chars.command.writeValueWithoutResponse(new Uint8Array([0x03]));
}
```

**`bleInit()` — auto-reconnect on PWA load:**
```js
async function bleInit() {
  if (!navigator.bluetooth) return;
  const devices = await navigator.bluetooth.getDevices();   // previously paired devices
  const watch = devices.find(d => d.name === 'HangTracker');
  if (watch) {
    watch.addEventListener('advertisementreceived', async () => {
      await _connectDevice(watch);
    });
    await watch.watchAdvertisements({ signal: _abortController.signal });
  }
}
```
This passively watches for the watch to come into range and auto-connects — no user action needed after initial pair.

### `index.html` changes
Add inside `#timer-screen`, above `#tap-btn-wrap`:
```html
<div id="ble-bar">
  <button id="ble-btn" onclick="bleConnect()">
    <!-- Bluetooth SVG icon -->
    <span id="ble-status">Pair Watch</span>
  </button>
  <span id="ble-sync-time"></span>  <!-- "Last sync: 2h ago" -->
</div>
<script defer src="ble.js"></script>
```
The button shows "Pair Watch" (grey) → "Connected — Syncing…" → "Synced (HH:MM)". Hidden if `!navigator.bluetooth`.

### `app.js` changes (2 additions)
1. End of `DOMContentLoaded` handler — call `bleInit()` to auto-reconnect:
   ```js
   if (typeof bleInit === 'function') bleInit();
   ```
2. In `saveSession()`, after `saveSessions(sessions)` — push updated target to watch:
   ```js
   if (bleIsConnected && bleIsConnected()) bleSyncTarget();
   ```

### `styles.css` changes
- `#ble-bar`: flex row, gap, margin-bottom matching `#tap-btn-wrap` spacing
- `#ble-btn`: secondary button style, uses `var(--fg2)` text, `var(--bg2)` background
- `.ble-connected` modifier: uses `var(--accent)` color, filled Bluetooth icon
- `.ble-syncing`: pulse animation (same as existing loading patterns in the app)
- `#ble-sync-time`: small muted text, DM Mono font

### `sw.js` changes
- Bump `CACHE`: `hang-v9` → `hang-v10`
- Add `'./ble.js'` to the `APP_SHELL` cache array

---

## What Does NOT Change
- `lib.js` — zero changes
- Existing timer/session flow — additive only; synced sessions use same `saveSessions()` path
- All existing unit and E2E tests — no changes required

---

## Limitations
- **iOS Safari**: Web Bluetooth not supported — `#ble-bar` hidden automatically
- **Initial pairing required once**: user must tap "Pair Watch" in the PWA once to authorize the connection; after that, auto-reconnect is seamless
- **Connect IQ requires Monkey C development**: separate project, built with Garmin Connect IQ SDK, sideloaded or published to IQ Store
- **Target is cached on watch**: if target advances (new qualifying day) but watch hasn't synced, watch uses the last known target — corrected on next sync when PWA opens

---

## Implementation Sequencing

### Phase 1 — PWA scaffolding (no watch needed)
1. Create `ble.js` with stub/console-only functions
2. Add `#ble-bar` to `index.html` with status span
3. Add `styles.css` BLE button styles + pulse animation
4. Add `bleInit()` call to `app.js` `DOMContentLoaded` and `bleSyncTarget()` after `saveSessions()`
5. Bump `sw.js`, add `ble.js` to APP_SHELL

### Phase 2 — Connect IQ app skeleton
1. Create widget project (FR255 + FR955 device targets)
2. Register GATT service, start advertising "HangTracker"
3. Implement characteristic read/write with hardcoded test values (targetSec=14, level=1)
4. Test: connect from Chrome on Android, verify reads return expected bytes

### Phase 3 — Full integration
1. Implement `SessionManager.mc` (countdown, timer, vibration, storage)
2. Implement `HangTrackerView.mc` (countdown/elapsed/done display)
3. Implement `Application.Storage` persistence in `BleDelegate.mc`
4. Implement full `ble.js`: `bleDrainSessions()`, `bleSyncTarget()`, `bleInit()` auto-reconnect
5. End-to-end test: complete hang on watch → open PWA → session appears with correct ts + duration

### Phase 4 — Polish
1. `watchAdvertisements()` auto-reconnect when watch comes into BLE range
2. Level 3 rep-count mode on watch (tap + button to increment reps)
3. "Last synced" timestamp in `#ble-sync-time`

---

## Critical Files

| File | Change |
|------|--------|
| `app.js` | +`bleInit()` call on load; +`bleSyncTarget()` after session save |
| `index.html` | Add `#ble-bar` with status span + `<script src="ble.js">` |
| `styles.css` | BLE button styles + `.ble-connected` / `.ble-syncing` modifiers |
| `sw.js` | Bump cache `hang-v9` → `hang-v10`, add `ble.js` to APP_SHELL |
| `ble.js` | **New file** — all Web Bluetooth logic |
| `HangTrackerWidget/` | **New Connect IQ project** (outside this repo, Monkey C) |

---

## Verification

1. Pair: tap "Pair Watch" in PWA → browser picker shows "HangTracker" → connect
2. PWA writes target + level to watch; watch display updates
3. Close PWA; complete a hang session on the watch; confirm "Saved!" on watch
4. Re-open PWA → auto-connects → toast "1 session synced from watch" → session in history
5. Target on watch updates correctly after sync reflects any progression advance
