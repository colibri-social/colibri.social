# @colibri-social/client

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
