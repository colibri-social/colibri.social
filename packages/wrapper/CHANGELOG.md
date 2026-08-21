# @colibri-social/wrapper

## 0.4.0

### Patch Changes

- 3df4a43: Fixes the fullscreen button on videos doing nothing in the macOS app.

  <!-- whatsnew
  title: Go big or go home
  icon: corners-out-fill
  body: The fullscreen button on a video now properly fullscreens the video.
  platforms: macos
  kind: fix
  -->

- Updated dependencies [c92163e]
- Updated dependencies [e71438b]
- Updated dependencies [b9abaed]
- Updated dependencies [b4b841e]
- Updated dependencies [3df4a43]
- Updated dependencies [35d15c3]
- Updated dependencies [912a90c]
- Updated dependencies [0096efa]
- Updated dependencies [44b4a34]
- Updated dependencies [b9abaed]
- Updated dependencies [80c75c0]
- Updated dependencies [e71438b]
- Updated dependencies [912a90c]
- Updated dependencies [e66562a]
- Updated dependencies [c7c105d]
- Updated dependencies [5a7aba1]
- Updated dependencies [9d58fa1]
- Updated dependencies [d9e6fdd]
- Updated dependencies [25ea05b]
- Updated dependencies [b40264f]
- Updated dependencies [ee90e53]
  - @colibri-social/client@0.4.0

## 0.3.0

### Minor Changes

- 3f13c9f: Fixes desktop notifications never appearing and adds an unread badge to the macOS dock. The notification plugin always reports permission as granted on desktop, so the code that switches notifications on after a successful prompt never ran and the setting stayed off unless you found the toggle in settings yourself. Desktop now opts in once on first launch, and turning it off still sticks. In-app toasts also stopped appearing entirely once notifications were on, even with the window focused, so those are back whenever the window is in front. On macOS notifications are now delivered through the system notification centre: they carry the sender's avatar, group per channel, open the right message when clicked, and disappear once the message is read. Windows notifications are now native toasts carrying the sender's avatar that open the right message when clicked. Windows does not group by channel and does not clear a toast once the message is read, since the toast API exposes no way to do either.

  <!-- whatsnew
  title: Desktop notifications
  icon: bell-ringing-fill
  body: Desktop notifications no longer need to be switched on by hand, and on macOS and Windows they show the sender's avatar and take you straight to the message. Your unread mention count now shows on the macOS dock icon.
  platforms: desktop
  kind: feature
  -->

### Patch Changes

- 90d61ff: Android push notifications now carry a "Mark as read" button, and author avatars in them are round instead of square.

  <!-- whatsnew
  title: Mark conversations read from the notification
  icon: checks-fill
  platforms: android
  kind: fix
  body: Notifications now have a "Mark as read" button that clears the conversation without opening the app, and author avatars in them are finally round.
  -->

- bab80fb: Take the work out of the mobile pane swipe. The drag no longer reads `window.innerWidth` in between the inline style writes it makes on four elements, so it stops forcing a layout flush every frame. Pointer moves are coalesced to one delivery per animation frame instead of one per event, which also covers swipe-to-reply, since every message row runs the same recognizer. The panes translate by pixels rather than a mixed-unit `calc()`, and animate `transform` through `translate3d` rather than the individual `translate` property, which keeps their layer geometry independent of layout mid-drag.

  Also fixes three things found alongside it: a swipe that starts over a category header no longer fires the collapse toggle (which persisted to local storage, so the channels stayed hidden afterwards), members without the manage permission can no longer start a category drag that freezes sidebar scrolling and then does nothing, and a touch drag now always requires a deliberate hold before a channel enters drag mode instead of depending on how the device reports its primary pointer.

  <!-- whatsnew
  title: Smoother channel swipes
  icon: hand-swipe-right-fill
  body: Swiping between the channel list, a channel and the member list should be less laggy.
  platforms: mobile
  kind: fix
  -->

- Updated dependencies [44e7e4d]
- Updated dependencies [6257430]
- Updated dependencies [46afe30]
- Updated dependencies [489026a]
- Updated dependencies [1f3ab7f]
- Updated dependencies [ff1ce5f]
- Updated dependencies [1c16781]
- Updated dependencies [3f13c9f]
- Updated dependencies [17bc302]
- Updated dependencies [90d61ff]
- Updated dependencies [75e5b3b]
- Updated dependencies [e9abd8a]
- Updated dependencies [e6787f9]
- Updated dependencies [85017b9]
- Updated dependencies [6381845]
- Updated dependencies [5a1dfea]
- Updated dependencies [bab80fb]
- Updated dependencies [d6d1f9d]
- Updated dependencies [489026a]
  - @colibri-social/client@0.3.0

## 0.2.1

### Patch Changes

- 180802f: Address the Play Console and App Store Connect recommendations: raise the iOS deployment target to 15.0, load notification images through Glide so they are downsampled and cached instead of decoded at full resolution, enable resource shrinking for Android release builds, and drive edge-to-edge from theme attributes so the system bar icons follow the app theme.
- Updated dependencies [f176caa]
- Updated dependencies [180802f]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
- Updated dependencies [467f933]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
- Updated dependencies [467f933]
- Updated dependencies [f176caa]
- Updated dependencies [f176caa]
  - @colibri-social/client@0.2.1

## 0.2.0

### Minor Changes

- 8424c6d: Set up automated Homebrew cask and Scoop bucket distribution for the desktop app.

### Patch Changes

- abc0d59: Adds better emoji handling and twemoji fallbacks
- ce7d4d5: Add login telemetry
- 4b45d38: Fixes deeplink issues on Windows
- c30cba7: fix: Padding issues on Android devices
- 171968c: Adds native FCM notifications for Android apps
- 84e878d: Adds support for Microsoft Store deployments
- 64fca4e: Fixes a few issues with console error spam
- 857aa9e: Recovers from a dropped local database during sign-in on iOS. iOS shuts down the storage the app keeps its session in whenever the app spends time in the background, which is exactly what happens while the sign-in sheet is open. The app now reopens that storage instead of failing every read for the rest of the session, and a slow read while starting up no longer signs you out.

  <!-- whatsnew
  title: Reliable Sign-In on iOS
  icon: key-fill
  body: Signing in on iPhone and iPad no longer gets stuck when the app is in the background during the sign-in sheet, and a slow start-up no longer signs you out.
  kind: fix
  -->

- d526785: Fixes for iOS and macOS login flows
- 9aaad31: Classifies wrapped network failures correctly and only shows a reference for reports that reached us
- 702c3ae: Fixes iOS app issues related to login and padding
- 5258c62: Fixes issues related to FCM notifications and pings in-app
- 24ce2db: feat: Sentry releases setup
- b1536c7: Signs in inside the app on iOS. The authorization page now opens in a native web authentication sheet, the same one macOS already used, instead of switching over to Safari and waiting for a deep link to come back. If the sheet cannot be presented, the old browser handoff still takes over.
- 4d81de8: Adds an iOS App Store leg to the release workflow and points Google Play uploads at the production track.
- 7696331: Adds support for team and play store tester labels and auto updating on supported platforms
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
- 2b3a886: Ships the macOS icon asset catalog as a prebuilt `Assets.car` instead of compiling it during the bundle step.

  `actool` exits non-zero on the GitHub macOS runners when the bundler compiles the Icon Composer source, which broke both macOS legs of the release (the notarized desktop build and the App Store package) even though the identical command succeeds locally on the same Xcode 26.6. Tauri accepts an already compiled `.car` in `bundle.icon` and copies it straight into the app bundle, so `icons/Assets.car` is committed next to `Colibri.icon` and the bundler never runs `actool` again.

  `pnpm --filter @colibri-social/wrapper assets-car` regenerates the catalog, and `pnpm --filter @colibri-social/wrapper icon` now does it as part of the icon pipeline. The hash of the Icon Composer source is recorded in `icons/Assets.car.sha256` and verified in CI, so changing `Colibri.icon` without regenerating the catalog fails the build instead of quietly shipping the previous icon.

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

- 112389a: Fixes the app icon on the home and splash screen.
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

- 7696331: Adds support for custom badges and auto-updating where supported, and fixes an issue where mobile invite modals would overflow
- ec472e1: Adds proper error handling and a timeout to the login screen
- 4bf4d94: Fixes the profile cards on the profile setup screen not filling available space on mobile
- e509882: fix: Safe-area padding no longer disappears after an Android WebView reload
- b3c9635: Moves twemoji to tauri bundled resources
- a5ea422: fix: On-screen keyboard no longer overlaps the message input on Android
- 2cdb3cf: Fixes sourcemap generation and adjusts the publish workflow to upload them to Sentry
- 112389a: Fixes an issue where the app would not handle logins properly
- 9dedb4a: Hides the "support" page in the settings on apps which get distributed to app stores
- Updated dependencies [57f95ee]
- Updated dependencies [9f5b509]
- Updated dependencies [e7d5e80]
- Updated dependencies [abc0d59]
- Updated dependencies [cfabe53]
- Updated dependencies [1a88b5d]
- Updated dependencies [ce7d4d5]
- Updated dependencies [9c7af6d]
- Updated dependencies [c30cba7]
- Updated dependencies [e0a5e5f]
- Updated dependencies [b315479]
- Updated dependencies [7f4ad84]
- Updated dependencies [2ceec79]
- Updated dependencies [536b3a3]
- Updated dependencies [171968c]
- Updated dependencies [0de7ee1]
- Updated dependencies [764a8bc]
- Updated dependencies [1a0b6b5]
- Updated dependencies [5480a4d]
- Updated dependencies [835198b]
- Updated dependencies [342ee16]
- Updated dependencies [66c6c75]
- Updated dependencies [9ae0edd]
- Updated dependencies [17e109e]
- Updated dependencies [5d90118]
- Updated dependencies [9dc8d8f]
- Updated dependencies [64fca4e]
- Updated dependencies [32714ae]
- Updated dependencies [0b6cd46]
- Updated dependencies [a924645]
- Updated dependencies [979f968]
- Updated dependencies [98c23f0]
- Updated dependencies [0eea035]
- Updated dependencies [6cb2c4f]
- Updated dependencies [97bd8f3]
- Updated dependencies [fa5297b]
- Updated dependencies [3b27f31]
- Updated dependencies [857aa9e]
- Updated dependencies [9364086]
- Updated dependencies [36cc84a]
- Updated dependencies [1cde6b4]
- Updated dependencies [85385b3]
- Updated dependencies [a7ca279]
- Updated dependencies [39a219f]
- Updated dependencies [d526785]
- Updated dependencies [795f9c7]
- Updated dependencies [9b84667]
- Updated dependencies [5258c62]
- Updated dependencies [9aaad31]
- Updated dependencies [702c3ae]
- Updated dependencies [f1597ae]
- Updated dependencies [32fd184]
- Updated dependencies [5258c62]
- Updated dependencies [df106e7]
- Updated dependencies [cd33c8c]
- Updated dependencies [9faa84c]
- Updated dependencies [bf105c0]
- Updated dependencies [7058ba3]
- Updated dependencies [b1536c7]
- Updated dependencies [b1536c7]
- Updated dependencies [df806af]
- Updated dependencies [8539830]
- Updated dependencies [fa3a6a8]
- Updated dependencies [0e459f3]
- Updated dependencies [fe04ee1]
- Updated dependencies [7696331]
- Updated dependencies [979f968]
- Updated dependencies [042f2c0]
- Updated dependencies [5cdb331]
- Updated dependencies [7379b04]
- Updated dependencies [e48ba9b]
- Updated dependencies [5160d9f]
- Updated dependencies [ddfd10c]
- Updated dependencies [5383a82]
- Updated dependencies [2607072]
- Updated dependencies [99e3e50]
- Updated dependencies [93374b8]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [fd0c7c7]
- Updated dependencies [2c24e97]
- Updated dependencies [244c83e]
- Updated dependencies [0c87079]
- Updated dependencies [7696331]
- Updated dependencies [8ddea05]
- Updated dependencies [75bfff8]
- Updated dependencies [5855f50]
- Updated dependencies [7ae9314]
- Updated dependencies [c57c2ea]
- Updated dependencies [3f1f55d]
- Updated dependencies [7136be7]
- Updated dependencies [ec472e1]
- Updated dependencies [dc43c69]
- Updated dependencies [0ec83ae]
- Updated dependencies [985043a]
- Updated dependencies [297bf92]
- Updated dependencies [7696331]
- Updated dependencies [9fe5418]
- Updated dependencies [0f3daca]
- Updated dependencies [3560f64]
- Updated dependencies [e7b2afe]
- Updated dependencies [9becfc4]
- Updated dependencies [733fa34]
- Updated dependencies [b3c9635]
- Updated dependencies [c57c2ea]
- Updated dependencies [99e3e50]
- Updated dependencies [618b27f]
- Updated dependencies [5412688]
- Updated dependencies [733fa34]
- Updated dependencies [2cdb3cf]
- Updated dependencies [4536e73]
- Updated dependencies [5019928]
- Updated dependencies [7cd245e]
- Updated dependencies [27b383b]
- Updated dependencies [fd0c7c7]
- Updated dependencies [3c54a9a]
- Updated dependencies [cb3eaa4]
- Updated dependencies [99e3e50]
- Updated dependencies [5262109]
- Updated dependencies [dff7523]
- Updated dependencies [ec91e45]
- Updated dependencies [9dedb4a]
  - @colibri-social/client@0.2.0
  - @colibri-social/assets@0.0.2

## 0.1.0-rc.15

### Patch Changes

- 9aaad31: Classifies wrapped network failures correctly and only shows a reference for reports that reached us
- b1536c7: Signs in inside the app on iOS. The authorization page now opens in a native web authentication sheet, the same one macOS already used, instead of switching over to Safari and waiting for a deep link to come back. If the sheet cannot be presented, the old browser handoff still takes over.
- 2b3a886: Ships the macOS icon asset catalog as a prebuilt `Assets.car` instead of compiling it during the bundle step.

  `actool` exits non-zero on the GitHub macOS runners when the bundler compiles the Icon Composer source, which broke both macOS legs of the release (the notarized desktop build and the App Store package) even though the identical command succeeds locally on the same Xcode 26.6. Tauri accepts an already compiled `.car` in `bundle.icon` and copies it straight into the app bundle, so `icons/Assets.car` is committed next to `Colibri.icon` and the bundler never runs `actool` again.

  `pnpm --filter @colibri-social/wrapper assets-car` regenerates the catalog, and `pnpm --filter @colibri-social/wrapper icon` now does it as part of the icon pipeline. The hash of the Icon Composer source is recorded in `icons/Assets.car.sha256` and verified in CI, so changing `Colibri.icon` without regenerating the catalog fails the build instead of quietly shipping the previous icon.

- Updated dependencies [66c6c75]
- Updated dependencies [9dc8d8f]
- Updated dependencies [9aaad31]
- Updated dependencies [b1536c7]
- Updated dependencies [b1536c7]
- Updated dependencies [df806af]
- Updated dependencies [fe04ee1]
- Updated dependencies [ddfd10c]
- Updated dependencies [5383a82]
- Updated dependencies [9fe5418]
- Updated dependencies [0f3daca]
  - @colibri-social/client@0.1.0-rc.15

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
