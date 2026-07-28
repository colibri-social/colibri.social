# @colibri-social/client

## 0.1.0-rc.10

### Minor Changes

- 57f95ee: Prompt web users once after logging in to enable notifications, with a dialog that requests browser permission and registers web push on accept. Also shrink the badges in the profile card to the same size used in messages.
- 1a88b5d: Add community banners

  <!-- whatsnew
  title: Community banners
  icon: image-fill
  body: Set a community banner to be displayed in the channel sidebar.
  kind: feature
  -->

- 5d90118: Adds a debug information section to the About settings page, with a button to copy everything (app/build, device, account, and runtime state) as a paste-ready block. Web builds now also report a real client version and commit instead of just "Web".

  <!-- whatsnew
  title: Debug Information
  icon: bug-fill
  body: The "About" page in the settings now contains debug information that can easily be copied.
  kind: feature
  -->

- fd0c7c7: Adds a "What's New" popup that appears once per release, listing the features and fixes that shipped, plus a settings page with the last five releases.

  <!-- whatsnew
  title: What's New popup
  icon: sparkle-fill
  body: This popup you're seeing!
  kind: feature
  -->

### Patch Changes

- ce7d4d5: Add login telemetry
- 536b3a3: Adds custom scrollbar styling
- 0de7ee1: Fixes drag/drop handling issues with channels

  <!-- whatsnew
  title: Improved Drag/Drop Handling
  icon: hand-grabbing-fill
  body: Issues with dragging and dropping channels on Desktop should be resolved now.
  kind: fix
  -->

- 0b6cd46: Makes touch interactions work on tablets
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

- c57c2ea: Make `tsc --noEmit` pass on the client: enable `skipLibCheck`, fix the duplicate-key spreads in the voice member-state updates, type the uploaded-files reset as `Set<File>`, return an `ArrayBuffer`-backed `Uint8Array` from the VAPID key decoder, and add type declarations for the assets package's `node` and `vite-verbatim-noise` entries. No runtime behaviour changes.
- 985043a: Fixes an issue with the debug buttons not opening outside the app
- 733fa34: Improves blockquote handling

  <!-- whatsnew
  title: Blockquotes
  icon: quotes-fill
  body: Improves the way blockquotes are handled in the chat input
  kind: fix
  -->

- c57c2ea: Fix XRPC wrappers sending the literal string `undefined` for omitted optional query parameters (`listRecords`, `listMessages`, `listNotifications`, `updateSeen`), and percent-encode the credentials passed to `registerCredentials` so a password containing `&` or `=` can no longer truncate the request or inject query parameters.
- 733fa34: Fixes three mobile swipe issues: a pane could stay partly on screen when swiping back, swiping was dead in channels containing an overflowing message, and swiping stuttered in communities with large member lists. Turning on swipe-to-reply now also disables swipe-to-open-members entirely, so the two gestures no longer compete — the member list stays reachable from the channel header
- 9dedb4a: Hides the "support" page in the settings on apps which get distributed to app stores

## 0.1.0-rc.9

### Patch Changes

- e7d5e80: Fixes issues related to swipe controls
- 1a0b6b5: Optimizes image loading for Avatars with a new "size" prop and better HTML attributes
- 5258c62: Fixes Homebrew installs failing to launch on macOS with "the application is damaged and can't be opened".

  The Homebrew cask wrote an install-channel marker into `Colibri Social.app/Contents/Resources/`, which invalidated the app bundle's code signature. Since Homebrew quarantines the app, Gatekeeper rejected it on first launch. Homebrew installs are now detected via the Caskroom directory instead, so nothing touches the signed bundle.

- 5258c62: Fixes issues related to FCM notifications and pings in-app
- Updated dependencies [5258c62]
  - @colibri-social/lib@0.0.2-rc.2

## 0.1.0-rc.8

### Patch Changes

- 764a8bc: Adds new badge types, a preferred badge selector, and a support page
- 342ee16: Fixes an issue on mobile devices that would cause the chat input to gradually be shown over the latest message and eventually "un-pin" the channel view if lots of text were to be inputted.
- 6cb2c4f: Fixes issues related to messages not being displayed and invalid notification counts
- fa5297b: Adds clipboard support for iOS and Android
- 1cde6b4: Gates allowed DIDs to an allowlist for sign ins and hides sign-up
- 85385b3: Makes cross-appview voice channels work
- d526785: Fixes for iOS and macOS login flows
- f1597ae: Automatically dismisses notifications if a channel is opened and the notification is still there.
- 32fd184: Improves emoji handling by serving images locally instead of relying on CDN
- cd33c8c: Improves the attachment experience for multi-attachment messages, mobile, and message sending
- 9faa84c: Adds single-user voice exclusivity.
- 0c87079: Fixes an error that would occur if a session got only partially removed
- dc43c69: Adds swipe controls to lightbox carousel
- 9becfc4: Fixes an issue that caused the keyboard to be displyed on the member and channel lists in certain cases
- b3c9635: Moves twemoji to tauri bundled resources
- 5019928: Improves wording and flow around community creation to be less technical
- cb3eaa4: Improves swipe controls
- Updated dependencies [764a8bc]
- Updated dependencies [32fd184]
- Updated dependencies [b3c9635]
  - @colibri-social/lib@0.0.2-rc.1
  - @colibri-social/assets@0.0.2-rc.1

## 0.1.0-rc.7

### Patch Changes

- abc0d59: Adds better emoji handling and twemoji fallbacks
- cfabe53: Improves mention handling in the text editor and user bio
- 171968c: Adds native FCM notifications for Android apps
- 835198b: Fixes swiping/dragging functionality as well as padding inconsistencies
- a924645: Adds better handling for links to images and image uploads as well as videos on mobile
- 0eea035: Makes a community's "settings" option only available to users who are allowed to change things, makes all links open in a browser instead of in-app for native apps, fixes mobile edit behavior, ensures login autocomplete always shows above keyboard
- 702c3ae: Fixes iOS app issues related to login and padding
- 297bf92: Adds support for web push notifications for all messages
- 4536e73: Fixes issues with reactions not being applied, as well as empty attachment notifications
- 7cd245e: Improves typing UX by adjusting line height and typing indicator
- Updated dependencies [abc0d59]
- Updated dependencies [297bf92]
  - @colibri-social/assets@0.0.2-rc.0
  - @colibri-social/lib@0.0.2-rc.0

## 0.1.0-rc.6

### Minor Changes

- 9c7af6d: Adds configurable swipe controls on mobile apps and the web

### Patch Changes

- 9f5b509: Makes multiple improvements to the way drawers are handled:
  - Drawers now fade instead of hard-cut at the bottom to indicate whether the user can scroll
  - Drawers have better gesture support (back gesture closes them)
  - Drawers can be extended up if they're scrollable by dragging the handle
  - All drawers use the same system now

- 7f4ad84: Fixes a crash that would occur when leaving a VC soon after disabling a camera/screen share.
- 7696331: Adds support for team and play store tester labels and auto updating on supported platforms
- 042f2c0: Fixes emoji and text input related issues
- 5160d9f: Adds better handling for the status changing mechanism
- 7696331: Adds support for custom badges and auto-updating where supported, and fixes an issue where mobile invite modals would overflow
- ec472e1: Adds proper error handling and a timeout to the login screen
- 7696331: Fixes the invite link creation modal not fitting mobile screens by rendering it as a bottom drawer on mobile instead of a centered dialog.
- e7b2afe: Fixes a crash on mobile layouts causing you to be unable to delete messages.

## 0.0.1-rc.5

### Patch Changes

- df106e7: Fixes missing padding in the settings modal
- 8ddea05: Stops the message composer from auto-focusing (and popping the on-screen keyboard) on mobile when opening or switching channels
- 75bfff8: Fixes an issue where navigating to a community which no longer existed (or the user no longer had access to) resulting in a crash and subsequent soft-lock
- 5855f50: Fixes mobile drawers only opening when the user released a press instead of when they pressed for long enough
- 7ae9314: Fixes broken atproto.at links on profile cards
- 3f1f55d: Fixes missing padding for the toaster component
- 0ec83ae: Fixes a crash that would occur when clicking on an invite link in-app in the native apps.

## 0.0.1-rc.4

### Patch Changes

- 5480a4d: Fixes drawer behavior on mobile devices
- a7ca279: Fixes a stale read error and undefined read in the community context and channel layout.
- 2cdb3cf: Fixes sourcemap generation and adjusts the publish workflow to upload them to Sentry

## 0.0.1-rc.3

### Patch Changes

- e48ba9b: Fixes a race condition in the deep link listener that caused logins to not work as intended.

## 0.0.1-rc.2

### Patch Changes

- 17e109e: Swaps the mobile settings drawer select chevron to an SVG controlled by us and hides the duplicate title.
- 5cdb331: fix: Show a disclaimer for returning users in the profile setup that their old data is safe
- 3560f64: fix: Channel now scrolls to the latest message when opening it for the first time on mobile

## 0.0.1-rc.1

### Patch Changes

- b315479: Enables notifications for native builds by default
- bf105c0: fix: Move reconnecting indicator below top bar

## 0.0.1-rc.0

### Patch Changes

- c30cba7: fix: Padding issues on Android devices
- 2ceec79: fix: Show loading screen instead of login screen on oauth redirect
