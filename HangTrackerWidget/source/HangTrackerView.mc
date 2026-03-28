import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class HangTrackerView extends WatchUi.View {

    function initialize() {
        View.initialize();
    }

    function onLayout(dc as Dc) as Void {
        // No XML layout — we draw everything in onUpdate
    }

    function onUpdate(dc as Dc) as Void {
        // Clear background
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
        // "READY" label
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 40, Graphics.FONT_MEDIUM, "READY", Graphics.TEXT_JUSTIFY_CENTER);

        // Level name
        var lvlName = _levelName();
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy, Graphics.FONT_SMALL, lvlName, Graphics.TEXT_JUSTIFY_CENTER);

        // Target
        var targetStr;
        if (level == 3) {
            targetStr = targetSec.toString() + " reps";
        } else {
            targetStr = targetSec.toString() + "s";
        }
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 32, Graphics.FONT_SMALL, targetStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Pending sessions count
        var pCount = pendingSessions.size();
        if (pCount > 0) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + 60, Graphics.FONT_XTINY, pCount + " pending", Graphics.TEXT_JUSTIFY_CENTER);
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

        // Elapsed time
        var timeStr = secs.toString() + "." + tenths.toString();
        var timeColor = Graphics.COLOR_WHITE;
        if (targetSec > 0 && secs >= targetSec) {
            timeColor = Graphics.COLOR_GREEN;
        }
        dc.setColor(timeColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 30, Graphics.FONT_NUMBER_HOT, timeStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Target reference
        var targetStr;
        if (level == 3) {
            targetStr = "target: " + targetSec.toString() + " reps";
        } else {
            targetStr = "target: " + targetSec.toString() + "s";
        }
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 30, Graphics.FONT_XTINY, targetStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Stop prompt
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 50, Graphics.FONT_TINY, "STOP", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // ── DONE ─────────────────────────────────────────

    hidden function _drawDone(dc as Dc, cx as Number, cy as Number) as Void {
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 10, Graphics.FONT_MEDIUM, "Saved!", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // ── Helpers ──────────────────────────────────────

    hidden function _levelName() as String {
        switch (level) {
            case 1:  return "L1 Passive Hang";
            case 2:  return "L2 Active Hang";
            case 3:  return "L3 Scap Shrugs";
            default: return "Level " + level.toString();
        }
    }
}

// ── Input delegate: ACTION key = start / stop ────────

class HangTrackerInputDelegate extends WatchUi.BehaviorDelegate {

    hidden var _view as HangTrackerView;

    function initialize(view as HangTrackerView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        // ACTION / SELECT button
        var mgr = sessionMgr;
        if (mgr == null) { return false; }

        switch (timerState) {
            case STATE_IDLE:
                mgr.startCountdown();
                return true;
            case STATE_COUNTDOWN:
                mgr.cancel();
                return true;
            case STATE_RUNNING:
                mgr.stopSession();
                return true;
            case STATE_DONE:
                // Ignore during done animation
                return true;
        }
        return false;
    }

    function onBack() as Boolean {
        // BACK button — cancel if active, otherwise let system handle (exit widget)
        var mgr = sessionMgr;
        if (mgr != null && timerState != STATE_IDLE) {
            mgr.cancel();
            return true;
        }
        return false;  // Let the system exit the widget
    }
}
