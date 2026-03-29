import Toybox.Application;
import Toybox.Application.Storage;
import Toybox.Lang;
import Toybox.WatchUi;

// Shared state — accessible from all modules
var targetSec  as Number = 14;
var delaySec   as Number = 5;
var sessionLog as Array = [];
var sessionMgr as SessionManager?;

class HangTrackerApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
        // Restore persisted state
        var storedTarget = Storage.getValue("targetSec");
        if (storedTarget != null) {
            targetSec = storedTarget as Number;
        }
        var storedDelay = Storage.getValue("delaySec");
        if (storedDelay != null) {
            delaySec = storedDelay as Number;
        }
        var storedLog = Storage.getValue("sessionLog");
        if (storedLog != null) {
            sessionLog = storedLog as Array;
        }

        sessionMgr = new SessionManager();
    }

    function onStop(state as Dictionary?) as Void {
        _persistAll();
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        var view = new HangTrackerView();
        var delegate = new HangTrackerInputDelegate(view);
        return [view, delegate];
    }
}

// Persistence helper (called from multiple places)
function _persistAll() as Void {
    Storage.setValue("targetSec", targetSec);
    Storage.setValue("delaySec", delaySec);
    Storage.setValue("sessionLog", sessionLog);
}
