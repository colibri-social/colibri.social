# @colibri-social/wrapper

The native app shell, built with [Tauri v2](https://v2.tauri.app). It hosts [`@colibri-social/app`](../app) as its frontend, so the same UI ships to desktop (Windows, macOS and Linux) and mobile (Android and iOS).

## Getting started

Run the app from this package. Tauri starts the frontend for you.

- `pnpm --filter @colibri-social/wrapper tauri dev`: desktop
- `pnpm --filter @colibri-social/wrapper tauri android dev`: Android (requires the Android SDK and NDK)

## Scripts

- `dev` / `start`: serve `@colibri-social/app` with Vite (invoked automatically by `tauri dev`)
- `build` / `build:android`: build `@colibri-social/app` into `packages/app/dist` (invoked automatically by `tauri build`)
- `serve`: preview the built frontend
- `tauri`: the Tauri CLI, wrapped by `scripts/tauri.mjs`. Use e.g. `pnpm tauri dev`, `pnpm tauri build`

The frontend scripts run through `scripts/frontend.mjs`, which passes the version from `src-tauri/tauri.conf.json` to the app as `VITE_APP_VERSION`.

## Runtime flags

- `COLIBRI_DISABLE_UPDATER=1` or `--no-update-check`: starts a desktop build without the updater plugin. The app skips update checks and the settings page hides the update section. Use for builds whose updates come from somewhere else, like a package manager.

## Build flags

- `DISABLE_SENTRY`: when set, excludes Sentry entirely from the frontend bundle and, via `scripts/tauri.mjs` (`--no-default-features`), from the Rust binary. Use for no-track distributions like F-Droid.
- `VITE_SENTRY_DSN`: enables frontend error reporting in production builds. Without a DSN it does nothing.
- `SENTRY_DSN`: enables the native (Rust) Sentry client at runtime, also bakeable at build time. Without a DSN it does nothing.
- `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`): required by `tauri build` because updater artifacts are enabled. Generate a keypair with `pnpm tauri signer generate` and set the matching `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

## Distribution channels

Apple platforms ship through three channels, built from the same source by three separate jobs in
`publish.yml`:

- **Direct / Homebrew**: `src-tauri/tauri.conf.json` as-is. Notarized with the _Developer ID
  Application_ identity, unsandboxed (`Entitlements.plist`), updater plugin enabled. Its version comes
  from the release train, i.e. the version `release.yml` passes to `publish.yml`.
- **Mac App Store**: overlaid with `src-tauri/tauri.appstore.conf.json`. Signed with the _Apple
  Distribution_ identity, sandboxed (`Entitlements.appstore.plist`), `embedded.provisionprofile`
  bundled, and the `updater` Cargo feature plus `capabilities/updater.json` compiled out (App Review
  guideline 3.3.2). `scripts/build-macos-appstore.sh` does the build and wraps the result with
  `productbuild` using the _3rd Party Mac Developer Installer_ identity.
- **iOS App Store**: `pnpm build:ios:appstore`. It runs `tauri ios build --archive-only --no-sign
  --ci`, then `scripts/export-ios-appstore.sh`. The script signs the app and its notification
  service extension with the _Apple Distribution_ identity and exports an IPA with `xcodebuild
  -exportArchive` into `src-tauri/gen/apple/build/export`. It reads two paths from the environment:
  `IOS_APP_PROFILE`, the App Store provisioning profile of the app, and `IOS_NSE_PROFILE`, the one
  of the notification service extension. `IOS_SIGNING_IDENTITY` and `APPLE_DEVELOPMENT_TEAM`
  override the signing identity and the team ID. The build uses `src-tauri/tauri.conf.json` with no
  overlay. The updater's Cargo dependencies are excluded on iOS, and `capabilities/updater.json`
  lists the desktop platforms only.

The two App Store jobs share the `appstore` and `appstore_only` inputs. Use `appstore_platform`
(`both`, `macos`, `ios`) to run only one of them.

### App Store versioning

`CFBundleShortVersionString` must be at most three period-separated integers, so an rc version like
`0.1.0-rc.13` cannot be uploaded as-is. `scripts/appstore-version.mjs` derives an acceptable one from
the release version:

- **Prerelease**: the counter becomes the patch component: `0.1.0-rc.13` -> `0.1.13`. This is only valid while
  the patch component is `0`. The script fails on any other patch component, because the result
  could be lower than the release itself.
- **Plain release**: used unchanged: `0.2.0` -> `0.2.0`. This is what takes over once the project
  leaves RC mode, and it stays ahead of every `0.1.x` the rc scheme produced.

`CFBundleVersion` is not stored in the repo either. CI passes the workflow run number via
`scripts/set-version.mjs --bundle-version=<n>`, keeping it monotonic across uploads of the same
marketing version.

Apple closes a version permanently once it has been approved: further uploads are rejected with
`90062` (must be higher than the approved version) or `90186` (pre-release train closed), whatever the
build number is. The `mas` and `ios` jobs treat those two codes as benign, warn, keep the signed
package as an artifact and skip the upload, and the release continues. Any other error code
fails the job.

### Review submission

After a successful upload the `mas` and `ios` jobs submit the build to App Review automatically, via
`app-store-connect publish --app-store` from `codemagic-cli-tools`. It waits for Apple to finish
processing the binary, creates the App Store version, attaches the build and submits, with
`--release-type AFTER_APPROVAL` so an approved version goes live on its own.

Both jobs pass `--cancel-previous-submissions`, so a new release supersedes one still sitting in
review. The submission runs on the `stable` channel. On the `spaces` channel, the jobs publish the
build to TestFlight.

"What's New" is required for updates and is generated from the release notes.
`scripts/render-release-notes.ts` in the repository root renders the entry for the release version
out of `RELEASE_NOTES`, falling back to the newest entry if that exact version has none. The same script feeds the Play
Store listing, trimmed to whole entries within Play's 500-character limit.

To resubmit without cutting a release, dispatch `publish.yml` with `appstore_only` set. That skips
every other channel, so it will not touch the GitHub release, the Homebrew cask, Scoop, Play or the
Microsoft Store:

```sh
gh workflow run publish.yml --ref main -f version=<release-version> -f appstore_only=true
```

Add `-f appstore_platform=ios` (or `macos`) to resubmit a single platform.

### Secrets

Both App Store jobs read `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_P8`, which must belong
to an App Manager (or Admin) key: a Developer-role key uploads builds but cannot create App Store
versions or submit for review. `IOS_CERTIFICATE` (+ `_PASSWORD`) is the _Apple Distribution_ identity
and covers both platforms. On top of that, macOS needs `MAC_PROVISIONPROFILE` and
`MAC_INSTALLER_CERTIFICATE` (+ `_PASSWORD`). iOS needs `IOS_PROVISIONPROFILE` and
`IOS_NSE_PROVISIONPROFILE`, the base64 of the App Store distribution provisioning profiles for
`social.colibri.app` and `social.colibri.app.NotificationService`. The `ios` job decodes them to
files and passes their paths to the export script as `IOS_APP_PROFILE` and `IOS_NSE_PROFILE`.

## Layout

- `scripts/`: the wrappers around the frontend build and the Tauri CLI, plus the versioning, icon and store packaging scripts
- `src-tauri/`: the Rust app. Plugins (updater, notification, single-instance, deep-link, window-state), capabilities, and platform permission files

The frontend lives in [`packages/app`](../app). This package has no frontend source of its own.

## Documentation

- [Client development](https://colibri.social/docs/developers/development/client#running-the-native-app): running the native app from source.
- [Testing native builds](https://colibri.social/docs/developers/development/native): building and installing the desktop, Android and iOS apps.
