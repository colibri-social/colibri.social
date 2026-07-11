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

## Layout

- `src/`: the frontend entry that mounts the client's `App`
- `src-tauri/`: the Rust app. Plugins (updater, notification, single-instance, deep-link, window-state), capabilities, and platform permission files
