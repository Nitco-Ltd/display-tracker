#!/bin/zsh
# Runs `npm run daily` (RMI sync -> SAP sync -> reports -> publish to the cloud) automatically on this Mac.
#
#   ./scripts/mac/setup-schedule.sh            install / update (10:00, 14:00, 18:00 every day)
#   ./scripts/mac/setup-schedule.sh remove     uninstall
#
# If the Mac is asleep at a scheduled time, macOS runs the job when it wakes.
# Logs: logs/daily-YYYY-MM.log (written by the job) and logs/launchd.log (anything printed before it starts).
set -euo pipefail

LABEL="in.nitco.displaytracker.daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NPM="$(command -v npm)"
NODE_DIR="$(dirname "$(command -v node)")"

if [[ "${1:-}" == "remove" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the Display Tracker schedule."
  exit 0
fi

mkdir -p "$APP_DIR/logs" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>ProgramArguments</key>
  <array><string>$NPM</string><string>run</string><string>daily</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$APP_DIR/logs/launchd.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/logs/launchd.log</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed: Display Tracker sync runs every day at 10:00, 14:00 and 18:00."
echo "Run it now:   launchctl kickstart gui/$(id -u)/$LABEL"
echo "Remove it:    ./scripts/mac/setup-schedule.sh remove"
