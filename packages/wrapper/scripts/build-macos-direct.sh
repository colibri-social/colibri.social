#!/usr/bin/env bash
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WRAPPER_DIR"

APP_SIGNING_IDENTITY="${APPLE_APP_SIGNING_IDENTITY:-Developer ID Application: Louis Escher (8V8SWK3942)}"

TARGET_DIR="$WRAPPER_DIR/src-tauri/target/universal-apple-darwin/release/bundle"
BUNDLE_DIR="$TARGET_DIR/macos"
DMG_DIR="$TARGET_DIR/dmg"
APP_PATH="$BUNDLE_DIR/Colibri Social.app"
ICON_SOURCE="$WRAPPER_DIR/src-tauri/icons/Colibri.icon"
ENTITLEMENTS="$WRAPPER_DIR/src-tauri/Entitlements.plist"

ICONLESS_CONFIG='{"bundle":{"icon":["icons/32x32.png","icons/128x128.png","icons/128x128@2x.png","icons/icon.icns","icons/icon.ico"]}}'

APP_VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
DMG_NAME="Colibri Social_${APP_VERSION}_universal.dmg"

rm -rf "$APP_PATH"

set +e
APPLE_SIGNING_IDENTITY="$APP_SIGNING_IDENTITY" node scripts/tauri.mjs build \
	--target universal-apple-darwin --bundles app --config "$ICONLESS_CONFIG"
TAURI_STATUS=$?
set -e

if [ ! -d "$APP_PATH" ]; then
	echo "tauri build did not produce $APP_PATH (exit $TAURI_STATUS)" >&2
	exit 1
fi

if [ "$TAURI_STATUS" -ne 0 ]; then
	echo "tauri build exited $TAURI_STATUS after bundling the app; continuing." >&2
	echo "this is expected without TAURI_SIGNING_PRIVATE_KEY, which only signs the updater artifact." >&2
fi

echo "--- compiling Icon Composer asset catalog ---"
CAR_DIR="$(mktemp -d)"
trap 'rm -rf "$CAR_DIR"' EXIT
cp -R "$ICON_SOURCE" "$CAR_DIR/Icon.icon"
mkdir -p "$CAR_DIR/out"
actool "$CAR_DIR/Icon.icon" \
	--compile "$CAR_DIR/out" \
	--app-icon Icon \
	--include-all-app-icons \
	--output-partial-info-plist "$CAR_DIR/out/partial.plist" \
	--platform macosx \
	--target-device mac \
	--minimum-deployment-target 26.0 \
	--errors --warnings

if [ ! -f "$CAR_DIR/out/Assets.car" ]; then
	echo "actool did not produce an Assets.car" >&2
	exit 1
fi

cp "$CAR_DIR/out/Assets.car" "$APP_PATH/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Add :CFBundleIconName string Icon" "$APP_PATH/Contents/Info.plist" 2>/dev/null \
	|| /usr/libexec/PlistBuddy -c "Set :CFBundleIconName Icon" "$APP_PATH/Contents/Info.plist"

echo "--- re-signing after asset injection ---"
codesign --force --sign "$APP_SIGNING_IDENTITY" \
	--entitlements "$ENTITLEMENTS" \
	--options runtime \
	--timestamp \
	"$APP_PATH"

echo "--- rebuilding dmg from the signed app ---"
detach_stale_volumes() {
	for volume in /Volumes/dmg.*; do
		[ -d "$volume" ] || continue
		hdiutil detach "$volume" -force >/dev/null 2>&1 || true
	done
	rm -f "$DMG_DIR"/rw.*.dmg
}

rm -f "$DMG_DIR/$DMG_NAME"
mkdir -p "$DMG_DIR"
cp "$APP_PATH/Contents/Resources/icon.icns" "$DMG_DIR/icon.icns"

DMG_BUILT=0
for attempt in 1 2 3; do
	detach_stale_volumes
	set +e
	(
		cd "$DMG_DIR"
		./bundle_dmg.sh \
			--volname "Colibri Social" \
			--icon "Colibri Social.app" 180 170 \
			--app-drop-link 480 170 \
			--window-size 660 400 \
			--hide-extension "Colibri Social.app" \
			--volicon "$DMG_DIR/icon.icns" \
			"$DMG_NAME" \
			"$APP_PATH"
	)
	DMG_STATUS=$?
	set -e
	if [ "$DMG_STATUS" -eq 0 ] && [ -f "$DMG_DIR/$DMG_NAME" ]; then
		DMG_BUILT=1
		break
	fi
	echo "dmg attempt $attempt failed (exit $DMG_STATUS), retrying" >&2
	sleep 3
done
detach_stale_volumes

if [ "$DMG_BUILT" -eq 1 ]; then
	codesign --force --sign "$APP_SIGNING_IDENTITY" --timestamp "$DMG_DIR/$DMG_NAME"
else
	echo "could not build the dmg; the signed .app is still valid and usable." >&2
fi

echo "--- verifying signed .app ---"
codesign --verify --strict "$APP_PATH"
codesign -d --entitlements :- "$APP_PATH"
codesign -dvvv "$APP_PATH" 2>&1 | grep -E "Authority|TeamIdentifier"
/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$APP_PATH/Contents/Info.plist"
test -f "$APP_PATH/Contents/Resources/Assets.car" && echo "Assets.car present"

echo "Direct-distribution app ready: $APP_PATH"
if [ "$DMG_BUILT" -eq 1 ]; then
	echo "Disk image: $DMG_DIR/$DMG_NAME"
fi
echo "Remember to notarize before distributing: xcrun notarytool submit ... && xcrun stapler staple \"$APP_PATH\""
