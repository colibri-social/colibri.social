# @colibri-social/ui

## 0.1.0

### Minor Changes

- 3a3f67d: Add a server picker to the Advanced settings page and an unreachable state for Spaces whose server doesn't answer, and reject server addresses with spaces or invalid host names

### Patch Changes

- 2b66d9b: Keep the message hover toolbar at the top-right corner of the message in Safari and the Mac app
- 4fb194e: Tests run on Vitest 5.1.2.
- 22a5df8: An open menu keeps its rows in place when its entries update. A Space's context menu, for example, no longer rebuilds every row and loses the highlighted item when its badge or mute state changes.
- 0f406f9: Fix several issues from tester feedback:

  - Dragging an image in the lightbox with a mouse drags the image itself, so you can drop it into another app. Mouse drags no longer switch to the next or previous image.
  - The "Jump to bottom" card shows up once you're more than five screens from the bottom and hides once you're within one and a half. On mobile it's as wide as the message box, keeps the same gap to the screen edges and the message box, and wraps its text to two lines.
  - Notification settings have a separate volume for the notification ping, join and leave sounds, mute and deafen sounds, and camera and screen share sounds. The ping starts at 50% and the others at 100%, or at your earlier sound effects volume if you changed it.
  - A Space no longer shows as unread because of a channel you muted.
  - Mentions in the channel you're looking at clear right away, and reading a channel clears its mention count and notifications.
  - The emoji and GIF panel opens at full height on mobile browsers.
  - Your own camera and screen share always show the local preview.

- 3aea636: A Space whose server doesn't respond stays in the Space rail, dimmed and marked as unreachable, under its last known name. Opening it shows who hosts it and a "Try again" button. While any Space can't be reached, the app checks again every minute
- df4aed3: The voice status panel shows a loading spinner in its connection tile while a call connects or reconnects.
- 6b07ebe: A right click on a message or a thread row in the narrow layout opens the same menu as a long press.
- df17b45: Opening a channel while the window is in the background no longer marks its notifications as seen. They clear once you return to the window.

  Media previews, the Inbox popover, Space rail tooltips, call controls and the screen share picker no longer create reactive work that is never cleaned up when their values are read from event handlers.

- Updated dependencies [4fb194e]
- Updated dependencies [2057d47]
- Updated dependencies [841a3cf]
- Updated dependencies [3a3f67d]
  - @colibri-social/lib@0.2.3

## 0.0.3

### Patch Changes

- 2ac8a4d: Send space URIs in the `at:space/` form the current Spaces PDS expects, and keep reading the older `at://{did}/space/...` form
- Updated dependencies [2ac8a4d]
  - @colibri-social/lib@0.2.2

## 0.0.2

### Patch Changes

- 23ffdef: Read space URIs in both the `at://{did}/space/...` and the `at:space/{did}/...` form, and send the legacy form only while the AppView lists the `legacySpaceUris` feature
- Updated dependencies [23ffdef]
  - @colibri-social/lib@0.2.1

## 0.0.1

### Patch Changes

- b6082ed: Fit the call controls on narrow phones. Below 26rem the six buttons spread across the bar instead of overflowing it.
