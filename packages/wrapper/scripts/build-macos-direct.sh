#!/usr/bin/env bash
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WRAPPER_DIR"

APP_SIGNING_IDENTITY="${APPLE_APP_SIGNING_IDENTITY:-Developer ID Application: Louis Escher (8V8SWK3942)}"

BUNDLE_DIR="$WRAPPER_DIR/src-tauri/target/universal-apple-darwin/release/bundle/macos"
APP_PATH="$BUNDLE_DIR/Colibri Social.app"

rm -rf "$APP_PATH"

APPLE_SIGNING_IDENTITY="$APP_SIGNING_IDENTITY" node scripts/tauri.mjs build \
	--target universal-apple-darwin

echo "--- verifying entitlements on signed .app ---"
codesign -d --entitlements :- "$APP_PATH"
codesign -dvvv "$APP_PATH" 2>&1 | grep -E "Authority|TeamIdentifier"

echo "Direct-distribution app ready: $APP_PATH"
echo "Bundled installers (dmg/updater artifacts) are in: $BUNDLE_DIR/.."
echo "Remember to notarize before distributing: xcrun notarytool submit ... && xcrun stapler staple \"$APP_PATH\""
