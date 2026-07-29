# @colibri-social/wrapper

The native app shell, built with [Tauri v2](https://v2.tauri.app). It embeds the [`@colibri-social/client`](../client) library's built `dist/` as its frontend so the same UI ships to desktop (Windows/macOS/Linux) and mobile (Android/iOS).

## Getting started

The shell renders the client's built output, so build the client first (`pnpm --filter @colibri-social/client build`), then run the app from this package:

- `pnpm --filter @colibri-social/wrapper tauri dev`: desktop
- `pnpm --filter @colibri-social/wrapper tauri android dev`: Android (requires the Android SDK/NDK)

## Scripts

- `dev` / `start`: serve the frontend shell with Vite (invoked automatically by `tauri dev`)
- `build`: bundle the frontend into `dist/` (invoked automatically by `tauri build`)
- `serve`: preview the built frontend
- `tauri`: the Tauri CLI, wrapped by `scripts/tauri.mjs`. Use e.g. `pnpm tauri dev`, `pnpm tauri build`

## Build flags

- `DISABLE_SENTRY`: when set, excludes Sentry entirely from the frontend bundle and, via `scripts/tauri.mjs` (`--no-default-features`), from the Rust binary. Use for no-track distributions like F-Droid.
- `SENTRY_DSN`: enables the native (Rust) Sentry client at runtime, also bakeable at build time. No DSN → no-op.
- `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`): required by `tauri build` because updater artifacts are enabled. Generate a keypair with `pnpm tauri signer generate` and set the matching `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

## Distribution channels

macOS ships through two channels, built from the same source by two separate jobs in `publish.yml`:

- **Direct / Homebrew**: `src-tauri/tauri.conf.json` as-is. Notarized with the _Developer ID
  Application_ identity, unsandboxed (`Entitlements.plist`), updater plugin enabled. Its version comes
  from the release train, i.e. the version `release.yml` passes to `publish.yml`.
- **Mac App Store**: overlaid with `src-tauri/tauri.appstore.conf.json`. Signed with the _Apple
  Distribution_ identity, sandboxed (`Entitlements.appstore.plist`), `embedded.provisionprofile`
  bundled, and the `updater` Cargo feature plus `capabilities/updater.json` compiled out (App Review
  guideline 3.3.2). `scripts/build-macos-appstore.sh` does the build and wraps the result with
  `productbuild` using the _3rd Party Mac Developer Installer_ identity.

### App Store versioning

`CFBundleShortVersionString` must be at most three period-separated integers, so an rc version like
`0.1.0-rc.13` cannot be uploaded as-is. `scripts/appstore-version.mjs` derives an acceptable one from
the release version:

- **Prerelease**: the counter becomes the patch component: `0.1.0-rc.13` -> `0.1.13`. Only valid while
  the patch component is `0`, the script fails loudly otherwise rather than risk emitting a lower
  version than the release itself.
- **Plain release**: used unchanged: `0.2.0` -> `0.2.0`. This is what takes over once the project
  leaves RC mode, and it stays ahead of every `0.1.x` the rc scheme produced.

`CFBundleVersion` is not stored in the repo either. CI passes the workflow run number via
`scripts/set-version.mjs --bundle-version=<n>`, keeping it monotonic across uploads of the same
marketing version.

Apple closes a version permanently once it has been approved: further uploads are rejected with
`90062` (must be higher than the approved version) or `90186` (pre-release train closed), whatever the
build number is. The `mas` job treats those two codes as benign, warns, keeps the signed `.pkg` as an
artifact and skips the upload rather than failing the release. Any other error code still fails.

### Review submission

After a successful upload the `mas` job submits the build to App Review automatically, via
`app-store-connect publish --app-store` from `codemagic-cli-tools`. It waits for Apple to finish
processing the binary, creates the App Store version, attaches the build and submits, with
`--release-type AFTER_APPROVAL` so an approved version goes live on its own, and
`--cancel-previous-submissions` so a new release supersedes one still sitting in review.

"What's New" is required for updates and is generated rather than written twice:
`scripts/render-release-notes.ts` renders the entry for the release version out of `RELEASE_NOTES`
(falling back to the newest entry if that exact version has none). The same script feeds the Play
Store listing, trimmed to whole entries within Play's 500-character limit.

To resubmit without cutting a release, dispatch `publish.yml` with `appstore_only` set. That skips
every other channel, so it will not touch the GitHub release, the Homebrew cask, Scoop, Play or the
Microsoft Store:

```sh
gh workflow run publish.yml --ref main -f version=<release-version> -f appstore_only=true
```

## Layout

- `src/`: the frontend entry that mounts the client's `App`
- `src-tauri/`: the Rust app. Plugins (updater, notification, single-instance, deep-link, window-state), capabilities, and platform permission files
