#!/usr/bin/env bash
# Downloads static, standalone arm64 FFmpeg + FFprobe and installs them as
# Tauri sidecars. Run once after cloning (the binaries are gitignored — ~50MB each).
#
#   bash scripts/fetch-ffmpeg.sh
#
# Source: osxexperts.net (native Apple Silicon, no Homebrew dependency).
set -euo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries"
TRIPLE="aarch64-apple-darwin"
WORK="$(mktemp -d)"
mkdir -p "$DEST"

echo "Downloading FFmpeg 8.1 (arm64)…"
curl -fsSL -o "$WORK/ffmpeg.zip" "https://www.osxexperts.net/ffmpeg81arm.zip"
curl -fsSL -o "$WORK/ffprobe.zip" "https://www.osxexperts.net/ffprobe81arm.zip"

unzip -o -q "$WORK/ffmpeg.zip" -d "$WORK"
unzip -o -q "$WORK/ffprobe.zip" -d "$WORK"

# Sanity check: must be arm64 and standalone.
file "$WORK/ffmpeg" | grep -q arm64 || { echo "ERROR: ffmpeg is not arm64"; exit 1; }

cp "$WORK/ffmpeg"  "$DEST/ffmpeg-$TRIPLE"
cp "$WORK/ffprobe" "$DEST/ffprobe-$TRIPLE"
chmod +x "$DEST/ffmpeg-$TRIPLE" "$DEST/ffprobe-$TRIPLE"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo "Installed:"
ls -la "$DEST"
echo "Done."
