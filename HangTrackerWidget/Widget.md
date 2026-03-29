# HangTracker Widget — Build & Deploy Guide

## Prerequisites

1. **Connect IQ SDK** — Download from https://developer.garmin.com/connect-iq/sdk/
   - Requires SDK Manager (`sdkmanager`) to install SDK + device files
   - Minimum SDK version: **4.0.0** (for BLE peripheral support)
2. **Java JDK 8+** — Required by the Monkey C compiler
3. **Garmin developer account** — https://developer.garmin.com (free, needed for device keys)

## One-time setup

### Install SDK via SDK Manager
```bash
# Windows: download ConnectIQ SDK Manager from the link above, run installer
# After install, open SDK Manager and:
#   1. Install the latest Connect IQ SDK (4.x)
#   2. Download device files for: FR255, FR255M, FR255S, FR255SM, FR955
```

### Generate a developer key
```bash
# From the SDK bin/ directory:
connectiq keygen -o developer_key.der
```
Keep `developer_key.der` somewhere permanent (e.g. `~/.garmin/developer_key.der`). You'll need it for every build.

### Add SDK to PATH
```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export PATH="$PATH:/path/to/connectiq-sdk/bin"
```

## Build

### Simulator build (for testing)
```bash
cd HangTrackerWidget
monkeyc -d fr255 -f monkey.jungle -o HangTracker.prg -y /path/to/developer_key.der
```

### Run in simulator
```bash
# Start the Connect IQ simulator first:
connectiq

# Then push the built app to it:
monkeydo HangTracker.prg fr255
```

### Release build (optimized, for sideloading or IQ Store)
```bash
monkeyc -d fr255 -f monkey.jungle -o HangTracker.prg -y /path/to/developer_key.der -r
```

To build for multiple devices at once (IQ Store package):
```bash
# Creates a .iq package containing all device variants
monkeyc -f monkey.jungle -o HangTracker.iq -y /path/to/developer_key.der -r -e
```

## Missing pieces before first build

The project needs a few more files that the SDK normally scaffolds:

### `monkey.jungle` (project build file)
Create this in the widget root:
```
project.manifest = manifest.xml
```

### Launcher icon
The manifest references `Rez.Drawables.LauncherIcon`. Create:
```
resources/drawables/launcher_icon.xml
resources/images/launcher.png       (40x40 px, 8-bit PNG)
```

`resources/drawables/launcher_icon.xml`:
```xml
<drawables>
    <bitmap id="LauncherIcon" filename="../images/launcher.png"/>
</drawables>
```

If you don't have an icon yet, use any 40x40 PNG as a placeholder.

## Sideload to watch (USB)

1. Connect watch to PC via USB cable
2. Watch appears as a mass storage device
3. Copy `HangTracker.prg` to `GARMIN/APPS/` on the watch
4. Eject & disconnect — the widget appears in the widget glances loop

## Publish to IQ Store

1. Go to https://apps.garmin.com/developer/
2. Create a new app listing
3. Upload the `.iq` package (multi-device build)
4. Fill in description, screenshots, etc.
5. Submit for review (usually 1-2 business days)

## Testing

### In simulator
- Press ACTION to start countdown → timer runs → press ACTION to stop → "Saved!"
- Verify state transitions: IDLE → COUNTDOWN → RUNNING → DONE → IDLE
- Use UP/DOWN to adjust target time
- Long-press UP for menu: adjust delay, view log, clear log

### On real hardware
1. Sideload widget to FR255/955
2. Open the widget on the watch (widget glance loop → tap to open)
3. Verify IDLE screen shows target time and delay
4. Press ACTION → countdown with vibrations → timer runs
5. Press ACTION again → session saved, "Saved!" shown
6. Long-press UP → "View Log" → verify session appears with correct time and duration

## Troubleshooting

- **Widget doesn't appear on watch** — Check `GARMIN/APPS/` has the `.prg` file. Reboot watch if needed.
