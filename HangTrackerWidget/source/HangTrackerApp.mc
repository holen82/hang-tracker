import Toybox.Application;
import Toybox.Application.Storage;
import Toybox.BluetoothLowEnergy;
import Toybox.Lang;
import Toybox.WatchUi;

// Shared state — accessible from all modules
var targetSec  as Number = 14;
var level      as Number = 1;
var pendingSessions as Array = [];
var sessionMgr as SessionManager?;

// GATT characteristic UUIDs (match profile.xml / ble.js)
const SVC_UUID     = BluetoothLowEnergy.stringToUuid("12ab3456-7890-cdef-0123-456789abcdef");
const TARGET_UUID  = BluetoothLowEnergy.stringToUuid("12ab3456-0001-cdef-0123-456789abcdef");
const LEVEL_UUID   = BluetoothLowEnergy.stringToUuid("12ab3456-0002-cdef-0123-456789abcdef");
const SESS_UUID    = BluetoothLowEnergy.stringToUuid("12ab3456-0003-cdef-0123-456789abcdef");
const CMD_UUID     = BluetoothLowEnergy.stringToUuid("12ab3456-0004-cdef-0123-456789abcdef");

class HangTrackerApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    // ── Lifecycle ────────────────────────────────────

    function onStart(state as Dictionary?) as Void {
        // Restore persisted state
        var storedTarget = Storage.getValue("targetSec");
        if (storedTarget != null) {
            targetSec = storedTarget as Number;
        }
        var storedLevel = Storage.getValue("level");
        if (storedLevel != null) {
            level = storedLevel as Number;
        }
        var storedSessions = Storage.getValue("pendingSessions");
        if (storedSessions != null) {
            pendingSessions = storedSessions as Array;
        }

        // Create session manager
        sessionMgr = new SessionManager();

        // Register BLE peripheral profile and delegate
        var profile = BluetoothLowEnergy.loadProfileFromXml("ble/profile");
        BluetoothLowEnergy.setDelegate(new HangBleDelegate());
        BluetoothLowEnergy.registerProfile(profile);
    }

    function onStop(state as Dictionary?) as Void {
        // Persist state on exit
        _persistAll();
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        var view = new HangTrackerView();
        var delegate = new HangTrackerInputDelegate(view);
        return [view, delegate];
    }
}

// ── Persistence helper (called from multiple places) ─

function _persistAll() as Void {
    Storage.setValue("targetSec", targetSec);
    Storage.setValue("level", level);
    Storage.setValue("pendingSessions", pendingSessions);
}
