import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class HangTrackerView extends WatchUi.View {

    function initialize() {
        View.initialize();
    }

    function onLayout(dc as Dc) as Void {
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;

        switch (timerState) {
            case STATE_IDLE:
                _drawIdle(dc, cx, cy);
                break;
            case STATE_COUNTDOWN:
                _drawCountdown(dc, cx, cy);
                break;
            case STATE_RUNNING:
                _drawRunning(dc, cx, cy);
                break;
            case STATE_DONE:
                _drawDone(dc, cx, cy);
                break;
        }
    }

    // ── IDLE ─────────────────────────────────────────

    hidden function _drawIdle(dc as Dc, cx as Number, cy as Number) as Void {
        // Title
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 55, Graphics.FONT_SMALL, "HANG TIMER", Graphics.TEXT_JUSTIFY_CENTER);

        // Target
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 25, Graphics.FONT_MEDIUM, targetSec.toString() + "s", Graphics.TEXT_JUSTIFY_CENTER);

        // Delay
        var delayStr;
        if (delaySec <= 0) {
            delayStr = "Delay: off";
        } else {
            delayStr = "Delay: " + delaySec.toString() + "s";
        }
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 10, Graphics.FONT_SMALL, delayStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Controls hint
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 40, Graphics.FONT_XTINY, "UP/DN adjust", Graphics.TEXT_JUSTIFY_CENTER);

        // Log count
        var logCount = sessionLog.size();
        if (logCount > 0) {
            dc.drawText(cx, cy + 58, Graphics.FONT_XTINY, logCount + " logged", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    // ── COUNTDOWN ────────────────────────────────────

    hidden function _drawCountdown(dc as Dc, cx as Number, cy as Number) as Void {
        var mgr = sessionMgr;
        if (mgr == null) { return; }

        var cdLeft = mgr.countdownLeft;
        var text;
        if (cdLeft <= 0) {
            text = "GO!";
        } else {
            text = cdLeft.toString();
        }

        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 20, Graphics.FONT_NUMBER_HOT, text, Graphics.TEXT_JUSTIFY_CENTER);
    }

    // ── RUNNING ──────────────────────────────────────

    hidden function _drawRunning(dc as Dc, cx as Number, cy as Number) as Void {
        var mgr = sessionMgr;
        if (mgr == null) { return; }

        var elapsed = mgr.elapsedMs;
        var secs = elapsed / 1000;
        var tenths = (elapsed % 1000) / 100;

        // Elapsed time — green when target reached
        var timeStr = secs.toString() + "." + tenths.toString();
        var timeColor = Graphics.COLOR_WHITE;
        if (targetSec > 0 && secs >= targetSec) {
            timeColor = Graphics.COLOR_GREEN;
        }
        dc.setColor(timeColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 30, Graphics.FONT_NUMBER_HOT, timeStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Target reference
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 30, Graphics.FONT_XTINY, "target: " + targetSec.toString() + "s", Graphics.TEXT_JUSTIFY_CENTER);

        // Stop prompt
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 50, Graphics.FONT_TINY, "STOP", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // ── DONE ─────────────────────────────────────────

    hidden function _drawDone(dc as Dc, cx as Number, cy as Number) as Void {
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 10, Graphics.FONT_MEDIUM, "Saved!", Graphics.TEXT_JUSTIFY_CENTER);
    }
}

// ── Input delegate ──────────────────────────────────

class HangTrackerInputDelegate extends WatchUi.BehaviorDelegate {

    hidden var _view as HangTrackerView;

    function initialize(view as HangTrackerView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        var mgr = sessionMgr;
        if (mgr == null) { return false; }

        switch (timerState) {
            case STATE_IDLE:
                mgr.startHang();
                return true;
            case STATE_COUNTDOWN:
                mgr.cancel();
                return true;
            case STATE_RUNNING:
                mgr.stopSession();
                return true;
            case STATE_DONE:
                return true;
        }
        return false;
    }

    // UP button (onPreviousPage) — increase target
    function onPreviousPage() as Boolean {
        if (timerState == STATE_IDLE) {
            targetSec += 1;
            if (targetSec > 120) { targetSec = 120; }
            _persistAll();
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // DOWN button (onNextPage) — decrease target
    function onNextPage() as Boolean {
        if (timerState == STATE_IDLE) {
            targetSec -= 1;
            if (targetSec < 1) { targetSec = 1; }
            _persistAll();
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // MENU (long-press UP)
    function onMenu() as Boolean {
        if (timerState != STATE_IDLE) { return false; }

        var menu = new WatchUi.Menu2({:title => "Hang Timer"});
        // Delay option — show current value
        var delayLabel;
        if (delaySec <= 0) {
            delayLabel = "Delay: off";
        } else {
            delayLabel = "Delay: " + delaySec.toString() + "s";
        }
        menu.addItem(new WatchUi.MenuItem(delayLabel, "Cycle: 0/3/5/10", :delay, {}));
        menu.addItem(new WatchUi.MenuItem("View Log", sessionLog.size() + " sessions", :viewLog, {}));
        menu.addItem(new WatchUi.MenuItem("Clear Log", "Delete all entries", :clearLog, {}));

        WatchUi.pushView(menu, new HangMenuDelegate(), WatchUi.SLIDE_UP);
        return true;
    }

    function onBack() as Boolean {
        var mgr = sessionMgr;
        if (mgr != null && timerState != STATE_IDLE) {
            mgr.cancel();
            return true;
        }
        return false;
    }
}

// ── Menu delegate ───────────────────────────────────

class HangMenuDelegate extends WatchUi.Menu2InputDelegate {

    // Delay values to cycle through
    hidden var _delayOptions as Array<Number> = [0, 3, 5, 10];

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();

        if (id == :delay) {
            // Cycle to next delay value
            var idx = 0;
            for (var i = 0; i < _delayOptions.size(); i++) {
                if (_delayOptions[i] == delaySec) {
                    idx = i;
                    break;
                }
            }
            idx = (idx + 1) % _delayOptions.size();
            delaySec = _delayOptions[idx];
            _persistAll();

            // Update the menu item label
            var label;
            if (delaySec <= 0) {
                label = "Delay: off";
            } else {
                label = "Delay: " + delaySec.toString() + "s";
            }
            item.setLabel(label);

        } else if (id == :viewLog) {
            // Push log view
            var logView = new LogView();
            WatchUi.pushView(logView, new LogViewDelegate(logView), WatchUi.SLIDE_LEFT);

        } else if (id == :clearLog) {
            sessionLog = [] as Array;
            _persistAll();
            item.setSubLabel("0 sessions");
        }
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}
