# Shipping the New Client in the Wrapper

The new client lives in `packages/app` and `packages/ui`. Testers get Colibri from `packages/wrapper`, the Tauri shell that `publish.yml` builds as `social.colibri.app` for TestFlight External, the Play "Spaces" track, the Microsoft Store flight and the `-beta` casks. This page lists what is left before testers get `packages/app` from it.

`packages/wrapper` builds `packages/app` through `scripts/frontend.mjs`, and it carries the preview's native code: `save_image`, the Android `received_files` scheme and `ReceiveFiles.kt`, the call service and `__colibriCall` bridge, `__colibriWindow`, `tauri-plugin-http`, and a vendored `wry` 0.55.1 with the Android keyboard content patch (`src-tauri/vendor/README.md`). Frontend Sentry lives in `packages/app/src/sentry/`.

The end state has one client and one shell: `packages/preview` and `packages/client` are deleted. The last section covers the removal.

For the open feature gaps between the two clients, see `parity.md`.

## Native Code the App Doesn't Call Yet

The wrapper registers these commands, all of which the old client calls:

- `apns_register`, `apns_remove_delivered` and `apns_take_activation` (`src/apns.rs`) for push on macOS and iOS.
- `native_notify`, `native_notify_supported`, `native_notify_dismiss`, `native_notify_cache_avatar`, `native_notify_take_activation` and `native_notify_clear_all` (`src/notifications/`).
- `screen_capture_supported`, `screen_capture_list_sources`, `screen_capture_start`, `screen_capture_stop`, `screen_capture_permission` and `screen_capture_open_settings` (`src/screen_capture/`).

It also carries `tauri-plugin-fcm`, `tauri-plugin-notification`, `tauri-plugin-updater`, `tauri-plugin-process` and `tauri-plugin-fs`, and on Android `ColibriFirebaseMessagingService.kt`, `MarkReadReceiver.kt` and `PendingMarkRead.kt` with the `__colibriNotificationActions` bridge.

## Wire the Wrapper's Native Code

Each item under "Native shell" in `parity.md` turns into wiring in `packages/app`. The native side already exists in the wrapper. The old client's call sites show the exact payloads:

- Notifications: `packages/client/src/notifications/` and `components/app/NativeNotifications.tsx` call the `native_notify*` commands.
- APNs and FCM: `packages/client/src/notifications/` and the `colibri-mark-read-pending` event.
- Screen capture: `packages/client/src/utils/native-capture.ts` and `utils/screen-share.ts`.
- Updater: `packages/client/src/components/app/AutoUpdater.tsx` and `utils/updater.ts`.

## Keep the Release Path

`publish.yml` dispatches manually from `feat/spaces-alpha` with `channel=spaces`. Merge this work into that branch before the first tester build. The spaces OAuth scheme `social.colibri.spaces:` stays registered in the Android manifest, the iOS `Info.plist` and `project.yml`, `tauri.conf.json`, the MSIX `bundle.config.json` and `linux/colibri.desktop`. `tauri.spaces.conf.json` points the desktop updater at `spaces.colibri.social/beta`.

## Verify the Switch

1. Build the wrapper for macOS with `pnpm tauri build --bundles app` and run it. Sign in, open a Space, send a message, and save an image from a message.
2. Build for Android with `pnpm tauri android build --apk` and install the universal release APK. Check the keyboard inset, sharing a file into the app, and a voice call in the background.
3. Build the iOS project and run it on a physical device. The preview has no iOS project, so this is the first run of the new client on iOS.
4. Run the Linux build on CEF.

Build one platform at a time. Parallel builds share `packages/app/dist` and the Cargo target directories.

## Remove the Preview and the Old Client

After testers run the new client from the wrapper, delete both packages. `packages/client` has more dependents than the wrapper, so move each of them first.

1. Move the website's imports from the old client to `packages/ui`: `hummingbird.css` in `src/styles/global.css`, `@colibri-social/client/hummingbird` in `FloatingHummingbird.tsx`, and `@colibri-social/client/animation` in `MockVoiceCall.tsx`. `packages/ui` already exports a `Hummingbird` component. Then drop the `packages/client` build and manifest from `apps/website/Dockerfile`.
2. Move the release notes. `scripts/collect-release-notes.ts`, `scripts/render-release-notes.ts` and `scripts/lib/icons.ts` read `packages/client/src/release-notes/` and `packages/client/package.json`. `scripts/lib/changesets.ts` keys the What's New check on `@colibri-social/client` (`CLIENT_PACKAGE`). Point all of them at the package that versions the new client. `parity.md` tracks the What's New page that reads these notes.
3. Update CI. Remove the client typecheck step from `pull_request.yml`, the `packages/client/**` filter and its job from `build.yml`, and the client build from `preview-release.yml`.
4. Update the workspace. Remove the `dev:client` and `dev:sandbox` scripts from the root `package.json`, the `./packages/client` reference from the root `tsconfig.json`, and the `packages/client` overrides from `biome.json`. Remove the `@colibri-social/client` dependency from `packages/wrapper/package.json` and `apps/website/package.json`.
5. Update the docs pages that describe the old client: `development/client.mdx`, `development/native.mdx`, `development/errors.mdx` and `self-hosting/getting-started.mdx` under `apps/website/src/content/docs/docs/`.
6. Delete `packages/preview` and `packages/client`, then run `pnpm install` to update the lockfile.

Run the four `pull_request.yml` jobs from a clean state afterwards. A stale `dist` or `*.tsbuildinfo` from a deleted package hides broken references.
