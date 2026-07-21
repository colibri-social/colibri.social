#!/usr/bin/env bash
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WRAPPER_DIR"

APP_SIGNING_IDENTITY="${APPLE_APP_SIGNING_IDENTITY:-Apple Distribution: Louis Escher (8V8SWK3942)}"
INSTALLER_SIGNING_IDENTITY="${APPLE_INSTALLER_SIGNING_IDENTITY:-3rd Party Mac Developer Installer: Louis Escher (8V8SWK3942)}"

BUNDLE_DIR="$WRAPPER_DIR/src-tauri/target/universal-apple-darwin/release/bundle/macos"
APP_PATH="$BUNDLE_DIR/Colibri Social.app"
PKG_OUT="$WRAPPER_DIR/src-tauri/Colibri Social (App Store).pkg"
UPDATER_CAPABILITY="$WRAPPER_DIR/src-tauri/capabilities/updater.json"
UPDATER_CAPABILITY_STASH="$WRAPPER_DIR/src-tauri/updater.json.disabled-for-appstore"
LOCK_DIR="$WRAPPER_DIR/src-tauri/.appstore-build.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
	echo "Another build-macos-appstore.sh run appears to be in progress ($LOCK_DIR exists). Aborting to avoid clobbering its capabilities/updater.json stash." >&2
	exit 1
fi

cleanup() {
	rm -rf "$LOCK_DIR"
	if [ -f "$UPDATER_CAPABILITY_STASH" ]; then
		mv "$UPDATER_CAPABILITY_STASH" "$UPDATER_CAPABILITY"
	fi
}
trap cleanup EXIT

rm -rf "$APP_PATH"
rm -f "$PKG_OUT"
mv "$UPDATER_CAPABILITY" "$UPDATER_CAPABILITY_STASH"

APPLE_SIGNING_IDENTITY="$APP_SIGNING_IDENTITY" node scripts/tauri.mjs build \
	--target universal-apple-darwin \
	--config "$WRAPPER_DIR/src-tauri/tauri.appstore.conf.json" \
	--features sentry \
	-- --no-default-features

echo "--- verifying entitlements on signed .app ---"
codesign -d --entitlements :- "$APP_PATH"
codesign -dvvv "$APP_PATH" 2>&1 | grep -E "Authority|TeamIdentifier"

productbuild --sign "$INSTALLER_SIGNING_IDENTITY" \
	--component "$APP_PATH" /Applications \
	"$PKG_OUT"

echo "--- verifying installer package signature ---"
pkgutil --check-signature "$PKG_OUT"

echo "App Store package ready: $PKG_OUT"
