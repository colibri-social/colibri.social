#!/usr/bin/env bash
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WRAPPER_DIR"

EXPORT_METHOD="${IOS_EXPORT_METHOD:-app-store-connect}"
IPA_DIR="$WRAPPER_DIR/src-tauri/gen/apple/build/arm64"
UPDATER_CAPABILITY="$WRAPPER_DIR/src-tauri/capabilities/updater.json"
UPDATER_CAPABILITY_STASH="$WRAPPER_DIR/src-tauri/updater.json.disabled-for-ios"
LOCK_DIR="$WRAPPER_DIR/src-tauri/.ios-build.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
	echo "Another build-ios-altstore.sh run appears to be in progress ($LOCK_DIR exists). Aborting to avoid clobbering its capabilities/updater.json stash." >&2
	exit 1
fi

cleanup() {
	rm -rf "$LOCK_DIR"
	if [ -f "$UPDATER_CAPABILITY_STASH" ]; then
		mv "$UPDATER_CAPABILITY_STASH" "$UPDATER_CAPABILITY"
	fi
}
trap cleanup EXIT

if [ -f "$UPDATER_CAPABILITY" ]; then
	mv "$UPDATER_CAPABILITY" "$UPDATER_CAPABILITY_STASH"
fi

node scripts/tauri.mjs ios build \
	--export-method "$EXPORT_METHOD" \
	--features sentry \
	-- --no-default-features

IPA="$(ls -t "$IPA_DIR"/*.ipa 2>/dev/null | head -n1 || true)"
if [ -z "$IPA" ]; then
	echo "No .ipa was produced in $IPA_DIR" >&2
	exit 1
fi

echo "--- verifying signature on the packaged app ---"
WORK="$(mktemp -d)"
unzip -q "$IPA" -d "$WORK"
APP="$(ls -d "$WORK"/Payload/*.app)"
codesign -dvvv "$APP" 2>&1 | grep -E "Authority|TeamIdentifier"
rm -rf "$WORK"

echo "IPA ready: $IPA"

if [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ]; then
	echo "--- uploading to App Store Connect for notarization ---"
	xcrun altool --upload-app -f "$IPA" -t ios \
		--apiKey "$APPLE_API_KEY" --apiIssuer "$APPLE_API_ISSUER"
	echo "Uploaded. In App Store Connect, set the version's Review Type to Notarization and submit."
else
	echo "APPLE_API_KEY / APPLE_API_ISSUER not set; skipping upload."
	echo "Upload manually with Transporter, or:"
	echo "  xcrun altool --upload-app -f \"$IPA\" -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>"
	echo "(altool reads the .p8 from ~/.appstoreconnect/private_keys/AuthKey<KEY_ID>.p8)"
fi
