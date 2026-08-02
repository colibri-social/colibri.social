# @colibri-social/wrapper

## 0.1.0-rc.14

### Patch Changes

- 979f968: Swaps in the new paper-cut hummingbird as the app icon everywhere: desktop, iOS, Android, Windows, the favicons, the web app manifest, and the sign-in provider list.

  Android 13 and newer now get a monochrome layer, so launchers that tint icons to the wallpaper palette render Colibri properly instead of falling back to the untinted foreground. The adaptive foreground is also rendered separately at each density and inset to the safe zone, which fixes the beak and tail being clipped by round and squircle launcher masks. The status bar notification icon is redrawn from the same artwork.

  The three vector variants of the mark are committed under `packages/assets/brand`, and every raster target is rendered from them by `pnpm brand:render`, so the icon set is reproducible rather than a pile of hand-exported files. `favicon.svg` drops from 300 KB of base64-encoded PNG to a 15 KB vector along the way.

  <!-- whatsnew
  title: A new app icon
  icon: sparkle-fill
  body: Colibri has a new app icon, a paper-cut hummingbird. On Android 13 and newer it also picks up your wallpaper colours if your launcher tints icons.
  kind: feature
  -->

- 2b1173c: Adds a Google Play production release path to CI.

  The client and wrapper packages are now a fixed version group, so they always release under the same version.

- 81e1408: Makes the direct-distribution macOS build reliable.
- 244c83e: Colibri on macOS, Windows and Linux now draws its own window title bar instead of using the plain system one, so the desktop app has the same branded header as the web app. The bar shows the community and channel you're in, and that same name is now what you see in the taskbar, in Alt-Tab and in Mission Control.
  There's a new "Use system window controls" switch in Settings under Preferences to go back to native controls.

  Also fixes the video viewer on desktop, which used a stand-in fullscreen mode that ignored Escape, and stops a trackpad pinch-zoom from shifting the whole app down.

  <!-- whatsnew
  title: A window title bar of our own
  icon: browser-fill
  body: The desktop app now has the same branded header as the web app, with the channel you're in shown in the title bar and the taskbar.
  kind: feature
  -->

- 692d211: Adds the new Liquid Glass app icon for macOS and iOS, built from an Icon Composer source so it renders with the real adaptive glass effect on macOS 26+ and iOS 26+ (with a flattened fallback on older systems).

  <!-- whatsnew
  title: New app icon on macOS
  icon: sparkle-fill
  body: Colibri has a new Liquid Glass app icon on macOS and iOS.
  kind: feature
  -->

- Updated dependencies [e0a5e5f]
- Updated dependencies [979f968]
- Updated dependencies [98c23f0]
- Updated dependencies [97bd8f3]
- Updated dependencies [3b27f31]
- Updated dependencies [36cc84a]
- Updated dependencies [39a219f]
- Updated dependencies [8539830]
- Updated dependencies [fa3a6a8]
- Updated dependencies [0e459f3]
- Updated dependencies [979f968]
- Updated dependencies [7379b04]
- Updated dependencies [99e3e50]
- Updated dependencies [93374b8]
- Updated dependencies [244c83e]
- Updated dependencies [7136be7]
- Updated dependencies [99e3e50]
- Updated dependencies [618b27f]
- Updated dependencies [99e3e50]
  - @colibri-social/client@0.1.0-rc.14
  - @colibri-social/assets@0.0.2-rc.3

## 0.1.0-rc.13

### Patch Changes

- 64fca4e: Fixes a few issues with console error spam
- Updated dependencies [64fca4e]
- Updated dependencies [7058ba3]
  - @colibri-social/client@0.1.0-rc.11

## 0.1.0-rc.12

### Patch Changes

- ce7d4d5: Add login telemetry
- fd0c7c7: Better emoji grid spacing on mobile
- fd0c7c7: Proper font size handling
- fd0c7c7: Improves native back behavior on mobile devices

  <!-- whatsnew
  title: Back Behavior
  icon: rewind-fill
  body: Using your mobile device's "navigate back" action should behave more predictably.
  kind: fix
  -->

- fd0c7c7: Fixes invite modal terminology
- 2c24e97: Improves keyboard pinning on Android

  <!-- whatsnew
  title: Keyboard pinning
  icon: keyboard-fill
  body: The channel should now stay pinned to the bottom after sending a message.
  kind: fix
  -->

- 9dedb4a: Hides the "support" page in the settings on apps which get distributed to app stores
- Updated dependencies [57f95ee]
- Updated dependencies [1a88b5d]
- Updated dependencies [ce7d4d5]
- Updated dependencies [536b3a3]
- Updated dependencies [0de7ee1]
- Updated dependencies [5d90118]
- Updated dependencies [0b6cd46]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [2c24e97]
- Updated dependencies [c57c2ea]
- Updated dependencies [985043a]
- Updated dependencies [733fa34]
- Updated dependencies [c57c2ea]
- Updated dependencies [733fa34]
- Updated dependencies [fd0c7c7]
- Updated dependencies [9dedb4a]
  - @colibri-social/client@0.1.0-rc.10
  - @colibri-social/assets@0.0.2-rc.2

## 0.1.0-rc.11

### Patch Changes

- 5258c62: Fixes issues related to FCM notifications and pings in-app
- Updated dependencies [e7d5e80]
- Updated dependencies [1a0b6b5]
- Updated dependencies [5258c62]
- Updated dependencies [5258c62]
  - @colibri-social/client@0.1.0-rc.9

## 0.1.0-rc.10

### Patch Changes

- 84e878d: Adds support for Microsoft Store deployments
- d526785: Fixes for iOS and macOS login flows
- b3c9635: Moves twemoji to tauri bundled resources
- Updated dependencies [764a8bc]
- Updated dependencies [342ee16]
- Updated dependencies [6cb2c4f]
- Updated dependencies [fa5297b]
- Updated dependencies [1cde6b4]
- Updated dependencies [85385b3]
- Updated dependencies [d526785]
- Updated dependencies [f1597ae]
- Updated dependencies [32fd184]
- Updated dependencies [cd33c8c]
- Updated dependencies [9faa84c]
- Updated dependencies [0c87079]
- Updated dependencies [dc43c69]
- Updated dependencies [9becfc4]
- Updated dependencies [b3c9635]
- Updated dependencies [5019928]
- Updated dependencies [cb3eaa4]
  - @colibri-social/client@0.1.0-rc.8
  - @colibri-social/assets@0.0.2-rc.1

## 0.1.0-rc.9

### Patch Changes

- abc0d59: Adds better emoji handling and twemoji fallbacks
- 171968c: Adds native FCM notifications for Android apps
- 702c3ae: Fixes iOS app issues related to login and padding
- Updated dependencies [abc0d59]
- Updated dependencies [cfabe53]
- Updated dependencies [171968c]
- Updated dependencies [835198b]
- Updated dependencies [a924645]
- Updated dependencies [0eea035]
- Updated dependencies [702c3ae]
- Updated dependencies [297bf92]
- Updated dependencies [4536e73]
- Updated dependencies [7cd245e]
  - @colibri-social/assets@0.0.2-rc.0
  - @colibri-social/client@0.1.0-rc.7

## 0.1.0-rc.8

### Patch Changes

- 4b45d38: Fixes deeplink issues on Windows
- 7696331: Adds support for team and play store tester labels and auto updating on supported platforms
- 7696331: Adds support for custom badges and auto-updating where supported, and fixes an issue where mobile invite modals would overflow
- ec472e1: Adds proper error handling and a timeout to the login screen
- Updated dependencies [9f5b509]
- Updated dependencies [9c7af6d]
- Updated dependencies [7f4ad84]
- Updated dependencies [7696331]
- Updated dependencies [042f2c0]
- Updated dependencies [5160d9f]
- Updated dependencies [7696331]
- Updated dependencies [ec472e1]
- Updated dependencies [7696331]
- Updated dependencies [e7b2afe]
  - @colibri-social/client@0.1.0-rc.6

## 0.1.0-rc.7

### Patch Changes

- Updated dependencies [df106e7]
- Updated dependencies [8ddea05]
- Updated dependencies [75bfff8]
- Updated dependencies [5855f50]
- Updated dependencies [7ae9314]
- Updated dependencies [3f1f55d]
- Updated dependencies [0ec83ae]
  - @colibri-social/client@0.0.1-rc.5

## 0.1.0-rc.6

### Patch Changes

- 2cdb3cf: Fixes sourcemap generation and adjusts the publish workflow to upload them to Sentry
- Updated dependencies [5480a4d]
- Updated dependencies [a7ca279]
- Updated dependencies [2cdb3cf]
  - @colibri-social/client@0.0.1-rc.4

## 0.1.0-rc.5

### Patch Changes

- e509882: fix: Safe-area padding no longer disappears after an Android WebView reload
- Updated dependencies [e48ba9b]
  - @colibri-social/client@0.0.1-rc.3

## 0.1.0-rc.4

### Patch Changes

- Updated dependencies [17e109e]
- Updated dependencies [5cdb331]
- Updated dependencies [3560f64]
  - @colibri-social/client@0.0.1-rc.2

## 0.1.0-rc.3

### Patch Changes

- a5ea422: fix: On-screen keyboard no longer overlaps the message input on Android
- Updated dependencies [b315479]
- Updated dependencies [bf105c0]
  - @colibri-social/client@0.0.1-rc.1

## 0.1.0-rc.2

### Patch Changes

- c30cba7: fix: Padding issues on Android devices
- 24ce2db: feat: Sentry releases setup
- 4bf4d94: Fixes the profile cards on the profile setup screen not filling available space on mobile
- Updated dependencies [c30cba7]
- Updated dependencies [2ceec79]
  - @colibri-social/client@0.0.1-rc.0

## 0.1.0-rc.1

### Patch Changes

- 112389a: Fixes the app icon on the home and splash screen.
- 112389a: Fixes an issue where the app would not handle logins properly

## 0.1.0-rc.0

### Minor Changes

- 8424c6d: Set up automated Homebrew cask and Scoop bucket distribution for the desktop app.
