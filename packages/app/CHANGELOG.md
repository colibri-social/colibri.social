# @colibri-social/app

## 0.1.0

### Minor Changes

- 3a3f67d: Add a server picker to Settings > Advanced. It checks the address, signs you out and opens sign-in on the chosen server
- c2536a8: Keeps your Spaces when you change servers
- 0afa5a7: Keeps a polyfilled user's attachments for a Space on another server with the rest of their repo there. Attachment uploads name the channel they're for, and moving to your own PDS reads each blob from the server that hosts its repo.
- 267a725: Opens a live socket to each server that manages one of your Spaces, so new messages, typing and presence from Spaces on other servers arrive in real time. A server's socket opens when the app first watches one of its Spaces and closes once nothing on it is watched. When a Space moves to another server, its watches move with it.
- 14628ef: Invite links now include the Space they belong to, so a Space on another Colibri server can be joined from any server. Older invite links keep working
- 4586930: After sign-in, the app adds its AppView to the user's `social.colibri.beta.actor.appview` record. Joining a Space that another AppView manages writes an `actor.remoteSpace` record to the preferences space, and the app grants each such AppView access to the preferences space. Leaving the Space, or being removed from it, deletes the record. Deleting your Colibri data also deletes both kinds of record
- 3aea636: A Space whose server doesn't respond stays in the Space rail, dimmed and marked as unreachable, under its last known name. Opening it shows who hosts it and a "Try again" button. While any Space can't be reached, the app checks again every minute
- ee3d18c: Voice calls in a Space on another server now connect to that server. The call gets its token for that server and picks among that server's voice nodes, and the voice debug panel shows that server's nodes.

  The app keeps each other server's node list on the device for 10 minutes, so a new session or a reopened socket skips listing and measuring that server's nodes again.

### Patch Changes

- 60cfdf0: The code highlighter no longer writes its loading messages to the browser console, and its warnings go through the app's logger. User badges, the profile popover and several menus, reorder and long-press handlers no longer create reactive work that is never cleaned up when they're read from an event handler.
- 3b7a541: Shows the "The message that pinged you was deleted." notice again when you open a channel whose ping points to a deleted message. Opening the channel marks its notifications as seen, and the check for deleted messages now still covers pings that opening the channel just marked.
- 4fb194e: Tests run on Vitest 5.1.2.
- 0f406f9: Fix several issues from tester feedback:

  - Dragging an image in the lightbox with a mouse drags the image itself, so you can drop it into another app. Mouse drags no longer switch to the next or previous image.
  - The "Jump to bottom" card shows up once you're more than five screens from the bottom and hides once you're within one and a half. On mobile it's as wide as the message box, keeps the same gap to the screen edges and the message box, and wraps its text to two lines.
  - Notification settings have a separate volume for the notification ping, join and leave sounds, mute and deafen sounds, and camera and screen share sounds. The ping starts at 50% and the others at 100%, or at your earlier sound effects volume if you changed it.
  - A Space no longer shows as unread because of a channel you muted.
  - Mentions in the channel you're looking at clear right away, and reading a channel clears its mention count and notifications.
  - The emoji and GIF panel opens at full height on mobile browsers.
  - Your own camera and screen share always show the local preview.

- 2057d47: Moves to `@colibri-social/lexicons` 2.46.0, which publishes the federation lexicons. The app now takes the `actor.appview` and `actor.remoteSpace` NSIDs and the federation fields of `listCommunities` and `getCommunity` from the lexicons. The website's lexicon reference includes the federation methods and records, the AppView specification lists the `social.colibri.beta.federation` methods and the `federation` feature, and the federation page covers `NotJoined`, `ActingForNotAllowed`, the blocks and mutes a receiving AppView applies, and the delivery retry rules.
- ef2be5d: Stop sharing preferences with a server once you leave its last Space, keep your open channel and activity in sync when a Space moves servers, and finish joining a Space without waiting on bookkeeping. The federation docs list the CORS headers an AppView needs for the server picker
- 4d7eb98: Cuts repeated calls to other servers:

  - The app remembers when each server's access to your synced preferences runs out. It grants access again only when that time is nearly up.
  - The app checks at most once a day that your account lists this server.
  - While a Space can't be reached, the app checks again after 1, 2, 5 and then every 10 minutes. The wait starts over at 1 minute when you return to the window or choose "Try again".

- a05833e: Reactions on a message read left to right in the order each emoji was first added, and a new reaction appears at the end.
- 4d7eb98: Grants access to your synced preferences again right away when another server reports that it has none, even if the app remembers an earlier grant. This happens at most once per server per session. When another server reports a later expiry than the app remembers, the app keeps that expiry. Signing out removes the remembered values from the device.
- 90f3e31: Keep your sent messages in place when someone else's older message arrives late, until the app restarts
- 1df46ab: Typing `@` in a channel or thread now suggests the five people who last sent a message there, newest first. As you type a name, the closest matches come first: names that start with your text, then handles, then names and handles that contain it.
- 841a3cf: Signing out because a session ended no longer sends a crash report, and a failed sign-in renewal caused by an unreachable server is reported as unreachable. Voice teardown no longer reports a stopped queue.
- 2101679: Screen share quality presets now cap the shorter edge of the shared screen, so 1080p on a 1440p monitor sends 1920x1080.
- df17b45: Opening a channel while the window is in the background no longer marks its notifications as seen. They clear once you return to the window.

  Media previews, the Inbox popover, Space rail tooltips, call controls and the screen share picker no longer create reactive work that is never cleaned up when their values are read from event handlers.

- Updated dependencies [2b66d9b]
- Updated dependencies [4fb194e]
- Updated dependencies [22a5df8]
- Updated dependencies [0f406f9]
- Updated dependencies [2057d47]
- Updated dependencies [3aea636]
- Updated dependencies [df4aed3]
- Updated dependencies [6b07ebe]
- Updated dependencies [841a3cf]
- Updated dependencies [3a3f67d]
- Updated dependencies [df17b45]
  - @colibri-social/ui@0.1.0
  - @colibri-social/lib@0.2.3

## 0.0.3

### Patch Changes

- 2ac8a4d: Send space URIs in the `at:space/` form the current Spaces PDS expects, and keep reading the older `at://{did}/space/...` form
- Updated dependencies [2ac8a4d]
  - @colibri-social/lib@0.2.2
  - @colibri-social/ui@0.0.3

## 0.0.2

### Patch Changes

- afb2445: Show bridged authors by name in Space and thread previews, and drop the gradient banner on invite pages for Spaces without a banner
- 1b63755: Start new roles with the Members role's permissions, place them below every other role and above Members, and always list Members as the bottom role
- 2d51a20: Send people back to sign-in when their sign-in server refuses to renew the session, for example after the app's sign-in details changed
- 569bc0e: Keep you signed in after closing your laptop or leaving the app in the background
- 1b63755: Fix saving a profile picture or banner for accounts on a server without Spaces support, which left new users stuck on a "That file isn't there anymore" screen after sign-up
- 23ffdef: Read space URIs in both the `at://{did}/space/...` and the `at:space/{did}/...` form, and send the legacy form only while the AppView lists the `legacySpaceUris` feature
- 1b63755: Changes the color and size of the Space profile overview indicator
- Updated dependencies [23ffdef]
  - @colibri-social/lib@0.2.1
  - @colibri-social/ui@0.0.2

## 0.0.1

### Patch Changes

- Updated dependencies [b6082ed]
  - @colibri-social/ui@0.0.1
