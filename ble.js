// ═══════════════════════════════════════════════════
//  BLE — Web Bluetooth integration for Garmin watch
// ═══════════════════════════════════════════════════

const BLE_SERVICE_UUID  = '12ab3456-7890-cdef-0123-456789abcdef';
const BLE_TARGET_CHAR   = '12ab3456-0001-cdef-0123-456789abcdef';
const BLE_LEVEL_CHAR    = '12ab3456-0002-cdef-0123-456789abcdef';
const BLE_SESSIONS_CHAR = '12ab3456-0003-cdef-0123-456789abcdef';
const BLE_COMMAND_CHAR  = '12ab3456-0004-cdef-0123-456789abcdef';

let _bleServer = null;
let _bleChars  = {};
let _bleAbort  = new AbortController();

// ── Public API ───────────────────────────────────────

function bleIsConnected() {
  return !!(_bleServer && _bleServer.connected);
}

async function bleInit() {
  if (!navigator.bluetooth) return;
  _showBleBar();
  try {
    const devices = await navigator.bluetooth.getDevices();
    const watch = devices.find(d => d.name === 'HangTracker');
    if (watch) {
      watch.addEventListener('advertisementreceived', async () => {
        try { await _bleConnectDevice(watch); } catch (e) { console.warn('BLE auto-connect failed:', e); }
      });
      await watch.watchAdvertisements({ signal: _bleAbort.signal });
    }
  } catch (e) {
    console.warn('BLE init:', e);
  }
}

async function bleConnect() {
  _bleSetStatus('connecting');
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'HangTracker' }],
      optionalServices: [BLE_SERVICE_UUID]
    });
    await _bleConnectDevice(device);
  } catch (e) {
    console.warn('BLE connect:', e);
    _bleSetStatus('disconnected');
  }
}

async function bleSyncTarget() {
  if (!bleIsConnected()) return;
  try {
    const s = getSettings();
    const lvl = getActiveLevel();
    const sessions = getSessions();
    const prog = computeProgression(sessions, s, lvl);
    const target = prog.targetVal;

    // Write target (uint16 LE)
    const targetBuf = new Uint8Array(2);
    new DataView(targetBuf.buffer).setUint16(0, target, true);
    await _bleChars.target.writeValue(targetBuf);

    // Write level (uint8)
    await _bleChars.level.writeValue(new Uint8Array([lvl]));
  } catch (e) {
    console.warn('BLE sync target:', e);
  }
}

async function bleDrainSessions() {
  if (!bleIsConnected()) return;
  try {
    const val = await _bleChars.sessions.readValue();
    const buf = val.buffer;
    if (buf.byteLength < 9) {
      // No pending sessions
      return;
    }
    const view = new DataView(buf);
    const count = Math.floor(buf.byteLength / 9);
    const existing = new Set(getSessions().map(s => s.ts));
    const allSessions = getSessions();
    let newCount = 0;

    for (let i = 0; i < count; i++) {
      const tsSec = view.getUint32(i * 9, true);
      const durMs = view.getUint32(i * 9 + 4, true);
      const level = view.getUint8(i * 9 + 8);
      const ts = tsSec * 1000;
      if (!existing.has(ts)) {
        allSessions.push({ ts, duration: durMs, level });
        newCount++;
      }
    }

    if (newCount > 0) {
      saveSessions(allSessions);
      if (typeof renderHistory === 'function') renderHistory();
      if (typeof refreshTimerUI === 'function') refreshTimerUI();
      showToast(`${newCount} session${newCount > 1 ? 's' : ''} synced from watch`);
    }

    // Clear watch queue
    await _bleChars.command.writeValueWithoutResponse(new Uint8Array([0x03]));
  } catch (e) {
    console.warn('BLE drain sessions:', e);
  }
}

// ── Internal helpers ─────────────────────────────────

async function _bleConnectDevice(device) {
  _bleSetStatus('connecting');
  device.addEventListener('gattserverdisconnected', () => {
    _bleSetStatus('disconnected');
    _bleServer = null;
    _bleChars = {};
  });

  _bleServer = await device.gatt.connect();
  const service = await _bleServer.getPrimaryService(BLE_SERVICE_UUID);

  _bleChars = {
    target:   await service.getCharacteristic(BLE_TARGET_CHAR),
    level:    await service.getCharacteristic(BLE_LEVEL_CHAR),
    sessions: await service.getCharacteristic(BLE_SESSIONS_CHAR),
    command:  await service.getCharacteristic(BLE_COMMAND_CHAR)
  };

  _bleSetStatus('syncing');

  // Push current target + level to watch, then drain pending sessions
  await bleSyncTarget();
  await bleDrainSessions();

  _bleSetStatus('connected');
  _bleUpdateSyncTime();
}

function _bleSetStatus(state) {
  const btn = document.getElementById('ble-btn');
  const label = document.getElementById('ble-status');
  if (!btn || !label) return;

  btn.classList.remove('ble-connected', 'ble-syncing');
  switch (state) {
    case 'connecting':
      label.textContent = 'Connecting…';
      btn.classList.add('ble-syncing');
      break;
    case 'syncing':
      label.textContent = 'Syncing…';
      btn.classList.add('ble-syncing');
      break;
    case 'connected':
      label.textContent = 'Connected';
      btn.classList.add('ble-connected');
      break;
    case 'disconnected':
    default:
      label.textContent = 'Pair Watch';
      break;
  }
}

function _bleUpdateSyncTime() {
  const el = document.getElementById('ble-sync-time');
  if (el) {
    const now = new Date();
    el.textContent = `Synced ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
}

function _showBleBar() {
  const bar = document.getElementById('ble-bar');
  if (bar) bar.classList.add('visible');
}
