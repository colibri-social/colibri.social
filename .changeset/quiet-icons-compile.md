---
"@colibri-social/wrapper": patch
---

Ships the macOS icon asset catalog as a prebuilt `Assets.car` instead of compiling it during the bundle step.

`actool` exits non-zero on the GitHub macOS runners when the bundler compiles the Icon Composer source, which broke both macOS legs of the release (the notarized desktop build and the App Store package) even though the identical command succeeds locally on the same Xcode 26.6. Tauri accepts an already compiled `.car` in `bundle.icon` and copies it straight into the app bundle, so `icons/Assets.car` is committed next to `Colibri.icon` and the bundler never runs `actool` again.

`pnpm --filter @colibri-social/wrapper assets-car` regenerates the catalog, and `pnpm --filter @colibri-social/wrapper icon` now does it as part of the icon pipeline. The hash of the Icon Composer source is recorded in `icons/Assets.car.sha256` and verified in CI, so changing `Colibri.icon` without regenerating the catalog fails the build instead of quietly shipping the previous icon.
