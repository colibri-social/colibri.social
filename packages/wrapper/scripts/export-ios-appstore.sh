#!/usr/bin/env bash
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLE_DIR="$WRAPPER_DIR/src-tauri/gen/apple"
ARCHIVE="$APPLE_DIR/build/colibri-social_iOS.xcarchive"
APP="$ARCHIVE/Products/Applications/Colibri Social.app"
APPEX="$APP/PlugIns/NotificationService.appex"
EXPORT_DIR="$APPLE_DIR/build/export"
PROFILES_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"

IDENTITY="${IOS_SIGNING_IDENTITY:-Apple Distribution: Louis Escher (8V8SWK3942)}"
TEAM_ID="${APPLE_DEVELOPMENT_TEAM:-8V8SWK3942}"
APP_BUNDLE_ID="social.colibri.app"
NSE_BUNDLE_ID="social.colibri.app.NotificationService"

: "${IOS_APP_PROFILE:?set IOS_APP_PROFILE to the app's App Store provisioning profile}"
: "${IOS_NSE_PROFILE:?set IOS_NSE_PROFILE to the notification extension's App Store provisioning profile}"

install_profile() {
	local uuid
	uuid=$(security cms -D -i "$1" | plutil -extract UUID raw -o - -)
	mkdir -p "$PROFILES_DIR"
	cp "$1" "$PROFILES_DIR/$uuid.mobileprovision"
	echo "$uuid"
}

APP_PROFILE_UUID=$(install_profile "$IOS_APP_PROFILE")
NSE_PROFILE_UUID=$(install_profile "$IOS_NSE_PROFILE")

test -d "$APP"
test -d "$APPEX"

if [ -d "$APP/Frameworks" ]; then
	find "$APP/Frameworks" -maxdepth 1 \( -name "*.dylib" -o -name "*.framework" \) -print0 |
		xargs -0 -I{} codesign --force --sign "$IDENTITY" "{}"
fi
codesign --force --sign "$IDENTITY" \
	--entitlements "$APPLE_DIR/NotificationService/NotificationService.entitlements" "$APPEX"
codesign --force --sign "$IDENTITY" \
	--entitlements "$APPLE_DIR/colibri-social_iOS/colibri-social_iOS.entitlements" "$APP"

EXPORT_OPTIONS="$(mktemp -d)/ExportOptions.plist"
plutil -create xml1 "$EXPORT_OPTIONS"
/usr/libexec/PlistBuddy \
	-c "Add :method string app-store-connect" \
	-c "Add :signingStyle string manual" \
	-c "Add :teamID string $TEAM_ID" \
	-c "Add :signingCertificate string Apple Distribution" \
	-c "Add :provisioningProfiles dict" \
	-c "Add :provisioningProfiles:$APP_BUNDLE_ID string $APP_PROFILE_UUID" \
	-c "Add :provisioningProfiles:$NSE_BUNDLE_ID string $NSE_PROFILE_UUID" \
	"$EXPORT_OPTIONS"

rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive \
	-archivePath "$ARCHIVE" \
	-exportPath "$EXPORT_DIR" \
	-exportOptionsPlist "$EXPORT_OPTIONS"

ls "$EXPORT_DIR"/*.ipa
