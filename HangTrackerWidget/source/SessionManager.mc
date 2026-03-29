import Toybox.Attention;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

// Timer states shared with the view
enum TimerState {
    STATE_IDLE,
    STATE_COUNTDOWN,
    STATE_RUNNING,
    STATE_DONE
}

var timerState as TimerState = STATE_IDLE;

class SessionManager {

    hidden var _timer      as Timer.Timer;
    hidden var _countdownLeft as Number = 0;
    hidden var _startMs    as Number = 0;
    hidden var _elapsed    as Number = 0;
    hidden var _hitTarget  as Boolean = false;

    // Publicly readable for the view
    var countdownLeft as Number = 0;
    var elapsedMs     as Number = 0;

    function initialize() {
        _timer = new Timer.Timer();
    }

    // ── Start (with or without countdown) ────────────

    function startHang() as Void {
        if (timerState != STATE_IDLE) { return; }

        _hitTarget = false;

        if (delaySec <= 0) {
            // No countdown — start immediately
            _startSession();
        } else {
            _countdownLeft = delaySec;
            countdownLeft  = delaySec;
            timerState     = STATE_COUNTDOWN;

            // Two short buzzes to announce countdown
            _vibrate([100, 80, 100]);

            _timer.start(method(:_onCountdownTick), 1000, true);
            WatchUi.requestUpdate();
        }
    }

    function _onCountdownTick() as Void {
        _countdownLeft -= 1;
        countdownLeft   = _countdownLeft;

        if (_countdownLeft <= 0) {
            _timer.stop();
            _startSession();
        } else {
            _vibrate([80]);
            WatchUi.requestUpdate();
        }
    }

    // ── Session ──────────────────────────────────────

    hidden function _startSession() as Void {
        _startMs   = _nowMs();
        _elapsed   = 0;
        elapsedMs  = 0;
        timerState = STATE_RUNNING;

        // One firm 300ms buzz
        _vibrate([300]);

        _timer.start(method(:_onRunningTick), 100, true);
        WatchUi.requestUpdate();
    }

    function _onRunningTick() as Void {
        _elapsed  = _nowMs() - _startMs;
        elapsedMs = _elapsed;

        // Check if target was just hit — auto-stop
        if (!_hitTarget && targetSec > 0) {
            var targetMs = targetSec * 1000;
            if (_elapsed >= targetMs) {
                _hitTarget = true;
                // Two long buzzes for target reached
                _vibrate([400, 200, 400]);
                stopSession();
                return;
            }
        }

        WatchUi.requestUpdate();
    }

    function stopSession() as Void {
        if (timerState != STATE_RUNNING) { return; }

        _timer.stop();
        var durationMs = _elapsed;
        timerState = STATE_DONE;

        // One 200ms buzz
        _vibrate([200]);

        // Record session to log
        var ts = Time.now().value();  // Unix seconds
        var sess = {
            "ts"  => ts,
            "dur" => durationMs
        };
        sessionLog.add(sess);
        _persistAll();

        WatchUi.requestUpdate();

        // After 2 seconds, return to IDLE
        _timer.start(method(:_onDoneTimeout), 2000, false);
    }

    function _onDoneTimeout() as Void {
        timerState = STATE_IDLE;
        WatchUi.requestUpdate();
    }

    // ── Cancel ───────────────────────────────────────

    function cancel() as Void {
        _timer.stop();
        timerState = STATE_IDLE;
        _elapsed   = 0;
        elapsedMs  = 0;
        WatchUi.requestUpdate();
    }

    // ── Helpers ──────────────────────────────────────

    hidden function _nowMs() as Number {
        return System.getTimer();
    }

    hidden function _vibrate(pattern as Array<Number>) as Void {
        if (Attention has :vibrate) {
            var vibeData = new [pattern.size()];
            for (var i = 0; i < pattern.size(); i++) {
                vibeData[i] = new Attention.VibeProfile(100, pattern[i]);
            }
            Attention.vibrate(vibeData);
        }
    }
}
