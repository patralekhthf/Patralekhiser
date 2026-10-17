#!/usr/bin/env bash
# Builds the .dmg without hdiutil's -srcfolder.
#
# Tauri's own bundle_dmg.sh calls `hdiutil create -srcfolder`, which needs a
# privileged attach to copy the files in. In a restricted environment that
# fails with "hdiutil: create failed - Resource busy", while a blank image,
# a normal attach and a convert all work fine. So this does the same job the
# long way: make an empty image, mount it, copy the app in, add the link to
# /Applications that makes the drag-to-install window work, then compress.
#
# Use it when `npx tauri build` produces Swara.app but dies on the dmg.
# On a normal machine and in CI, `npx tauri build` alone is enough and this
# script is not needed.
#
#   ./make-dmg.sh [output-directory]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/src-tauri/target/release/bundle/macos/Swara.app"
OUT="${1:-$HERE/../dist}"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] && ARCH="aarch64"
DMG="$OUT/Swara_${VERSION}_${ARCH}.dmg"

[ -d "$APP" ] || { echo "Swara.app not found. Run: npx tauri build" >&2; exit 1; }
mkdir -p "$OUT"

WORK="$(mktemp -d)"
cleanup() {
  [ -n "${DEV:-}" ] && hdiutil detach "$DEV" -quiet 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Size the image from the app plus headroom, so it never runs out mid-copy.
SIZE_MB=$(( $(du -sm "$APP" | cut -f1) + 12 ))

hdiutil create -size "${SIZE_MB}m" -fs HFS+ -volname Swara -layout SPUD "$WORK/rw.dmg" >/dev/null
ATTACH="$(hdiutil attach "$WORK/rw.dmg" -nobrowse | tail -1)"
DEV="$(echo "$ATTACH" | awk '{print $1}')"
MNT="$(echo "$ATTACH" | sed 's|.*\(/Volumes/.*\)|\1|')"

ditto "$APP" "$MNT/Swara.app"
ln -sf /Applications "$MNT/Applications"

hdiutil detach "$DEV" -quiet
DEV=""
sleep 1

rm -f "$DMG"
hdiutil convert "$WORK/rw.dmg" -format UDZO -o "$DMG" >/dev/null
echo "Built $DMG ($(du -h "$DMG" | cut -f1))"

# State the signing position plainly rather than leaving it to be discovered
# by whoever downloads it first.
if ! codesign -dv "$APP" 2>&1 | grep -q "TeamIdentifier=[A-Z0-9]"; then
  echo
  echo "NOTE: this build is ad-hoc signed and not notarized. Gatekeeper will"
  echo "block it on anyone else's Mac. Fine for your own machine; not yet"
  echo "fine for a download link."
fi
