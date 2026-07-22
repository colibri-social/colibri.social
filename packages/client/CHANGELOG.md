# @colibri-social/client

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
