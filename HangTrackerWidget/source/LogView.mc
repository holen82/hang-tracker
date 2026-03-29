import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

class LogView extends WatchUi.View {

    hidden var _scrollOffset as Number = 0;
    hidden const VISIBLE_ROWS = 4;

    function initialize() {
        View.initialize();
        // Start at the most recent entries (end of list)
        var count = sessionLog.size();
        if (count > VISIBLE_ROWS) {
            _scrollOffset = count - VISIBLE_ROWS;
        }
    }

    function scrollUp() as Void {
        if (_scrollOffset > 0) {
            _scrollOffset -= 1;
            WatchUi.requestUpdate();
        }
    }

    function scrollDown() as Void {
        var count = sessionLog.size();
        if (_scrollOffset < count - VISIBLE_ROWS) {
            _scrollOffset += 1;
            WatchUi.requestUpdate();
        }
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var cx = w / 2;
        var count = sessionLog.size();

        // Title
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 15, Graphics.FONT_SMALL, "Session Log", Graphics.TEXT_JUSTIFY_CENTER);

        if (count == 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 80, Graphics.FONT_SMALL, "No sessions", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Draw rows (most recent first within visible window)
        var yStart = 50;
        var rowHeight = 35;
        var end = _scrollOffset + VISIBLE_ROWS;
        if (end > count) { end = count; }

        for (var i = end - 1; i >= _scrollOffset; i--) {
            var sess = sessionLog[i] as Dictionary;
            var ts = sess["ts"] as Number;
            var dur = sess["dur"] as Number;

            // Format date/time from Unix timestamp
            var moment = new Time.Moment(ts);
            var info = Gregorian.info(moment, Time.FORMAT_SHORT);
            var dateStr = info.month.toString() + "/" + info.day.toString();
            var hourStr = info.hour.toString();
            if (info.hour < 10) { hourStr = "0" + hourStr; }
            var minStr = info.min.toString();
            if (info.min < 10) { minStr = "0" + minStr; }
            var timeStr = hourStr + ":" + minStr;

            // Format duration
            var durSec = dur / 1000;
            var durTenths = (dur % 1000) / 100;
            var durStr = durSec.toString() + "." + durTenths.toString() + "s";

            var row = end - 1 - i;  // 0-based row from top
            var y = yStart + row * rowHeight;

            // Date + time
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx - 40, y, Graphics.FONT_XTINY, dateStr + " " + timeStr, Graphics.TEXT_JUSTIFY_CENTER);

            // Duration
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx + 50, y, Graphics.FONT_TINY, durStr, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Scroll indicators
        if (_scrollOffset > 0) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, yStart + VISIBLE_ROWS * rowHeight + 5, Graphics.FONT_XTINY, "^ more", Graphics.TEXT_JUSTIFY_CENTER);
        }
        if (end < count) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, yStart + VISIBLE_ROWS * rowHeight + 5, Graphics.FONT_XTINY, "v more", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }
}

class LogViewDelegate extends WatchUi.BehaviorDelegate {

    hidden var _logView as LogView;

    function initialize(logView as LogView) {
        BehaviorDelegate.initialize();
        _logView = logView;
    }

    function onNextPage() as Boolean {
        _logView.scrollDown();
        return true;
    }

    function onPreviousPage() as Boolean {
        _logView.scrollUp();
        return true;
    }

    function onBack() as Boolean {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }
}
