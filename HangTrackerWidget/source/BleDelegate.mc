import Toybox.BluetoothLowEnergy;
import Toybox.Lang;

class HangBleDelegate extends BluetoothLowEnergy.BleDelegate {

    function initialize() {
        BleDelegate.initialize();
    }

    // ── Characteristic reads ─────────────────────────

    function onCharacteristicRead(request as BluetoothLowEnergy.CharacteristicReadRequest) as Void {
        var uuid = request.getCharacteristic().getUuid();
        var data = null;

        if (uuid.equals(TARGET_UUID)) {
            // uint16 LE — target seconds
            data = new [2]b;
            data[0] = (targetSec & 0xFF).toNumber();
            data[1] = ((targetSec >> 8) & 0xFF).toNumber();

        } else if (uuid.equals(LEVEL_UUID)) {
            // uint8 — level
            data = new [1]b;
            data[0] = (level & 0xFF).toNumber();

        } else if (uuid.equals(SESS_UUID)) {
            // 9 bytes per pending session
            var count = pendingSessions.size();
            if (count > 56) { count = 56; }  // cap at 512 bytes
            data = new [count * 9]b;
            for (var i = 0; i < count; i++) {
                var sess = pendingSessions[i] as Dictionary;
                var ts   = (sess["ts"]   as Number);
                var dur  = (sess["dur"]  as Number);
                var lvl  = (sess["lvl"]  as Number);
                var off  = i * 9;
                // uint32 LE — timestamp
                data[off]     = (ts & 0xFF).toNumber();
                data[off + 1] = ((ts >> 8) & 0xFF).toNumber();
                data[off + 2] = ((ts >> 16) & 0xFF).toNumber();
                data[off + 3] = ((ts >> 24) & 0xFF).toNumber();
                // uint32 LE — duration ms (or rep count for L3)
                data[off + 4] = (dur & 0xFF).toNumber();
                data[off + 5] = ((dur >> 8) & 0xFF).toNumber();
                data[off + 6] = ((dur >> 16) & 0xFF).toNumber();
                data[off + 7] = ((dur >> 24) & 0xFF).toNumber();
                // uint8 — level
                data[off + 8] = (lvl & 0xFF).toNumber();
            }
        }

        if (data != null) {
            request.respond(data);
        } else {
            request.respond(null);
        }
    }

    // ── Characteristic writes ────────────────────────

    function onCharacteristicWrite(request as BluetoothLowEnergy.CharacteristicWriteRequest) as Void {
        var uuid  = request.getCharacteristic().getUuid();
        var value = request.getValue();

        if (uuid.equals(TARGET_UUID) && value != null && value.size() >= 2) {
            // uint16 LE
            targetSec = (value[1] << 8) | value[0];
            _persistAll();

        } else if (uuid.equals(LEVEL_UUID) && value != null && value.size() >= 1) {
            // uint8
            level = value[0] & 0xFF;
            if (level < 1) { level = 1; }
            if (level > 3) { level = 3; }
            _persistAll();

        } else if (uuid.equals(CMD_UUID) && value != null && value.size() >= 1) {
            var cmd = value[0] & 0xFF;
            if (cmd == 0x01 && sessionMgr != null) {
                // Start session (phone-triggered)
                sessionMgr.startCountdown();
            } else if (cmd == 0x02 && sessionMgr != null) {
                // Cancel
                sessionMgr.cancel();
            } else if (cmd == 0x03) {
                // Clear pending sessions
                pendingSessions = [] as Array;
                _persistAll();
            }
        }

        // Refresh the view
        WatchUi.requestUpdate();
    }
}
