# @colibri-social/client

## 0.1.0-rc.15

### Minor Changes

- 9dc8d8f: Add screen share quality settings and screen audio

  Screen sharing now has a pre-share dialog for picking resolution (720p, 1080p, 1440p or source) and frame rate (15, 30 or 60), plus a dropdown next to the share button for changing quality while already streaming. Streams can now carry sound from the captured tab or screen where the browser engine supports it, with its own per-participant volume slider separate from the person's voice. Quality choices map to capture constraints, a content hint, a bitrate ceiling and a degradation preference, so a low frame rate now favours a sharp picture.

  On Windows and MacOS, the app also displays a proper Application/Window/Screen picker.

  <!-- whatsnew
  title: Screen Share Improvements
  icon: monitor-play-fill
  body: The Windows and MacOS apps have gained an app/window/screen picker, plus you're able to share stream audio and change the stream's quality on any device.
  kind: feature
  -->

- 9fe5418: Adds self-service account deletion

  <!-- whatsnew
  title: Data Deletion
  icon: trash-fill
  body: Adds an in-app data deletion option in the settings.
  kind: feature
  -->

### Patch Changes

- 66c6c75: Rework channel message scrolling around a single anchor controller

  <!-- whatsnew
  title: Smoother Older Message Loading
  icon: arrow-line-up-fill
  body: Scrolling up to load older messages in a channel no longer jumps your view around, and late-loading images no longer shift what you are reading.
  kind: fix
  -->

- 9aaad31: Classifies wrapped network failures correctly and only shows a reference for reports that reached us
- b1536c7: Signs in inside the app on iOS. The authorization page now opens in a native web authentication sheet, the same one macOS already used, instead of switching over to Safari and waiting for a deep link to come back. If the sheet cannot be presented, the old browser handoff still takes over.
- b1536c7: Lifts the sign-in pane above the on-screen keyboard on tablets. The two-pane layout centred its form in the full window height, so in landscape the keyboard covered the handle input while it was being typed into. The pane now centres in the space the keyboard leaves, following the same spring the keyboard animates with.
- df806af: Show the channel loading states ("Loading messages", "Loading older messages", "Catching up") as a floating pill over the message list instead of an in-flow line at the top, so the conversation no longer shifts when they appear or disappear. The pill is now shared with the reconnecting indicator.
- fe04ee1: Fixes phantom ping badges. Opening a channel that only had unread messages turned the white unread dot into a red ping badge, and marking the channel as read could not clear it. The client now only applies ping arithmetic to mention and reply notifications instead of every unseen message, and never increments a count it did not decrement. Marking a channel, category, or community as read also resyncs the badge from the server, so a stale count can always be cleared without reloading. The "message that caused this ping has been deleted" banner no longer appears for ordinary unread messages.

  <!-- whatsnew
  title: Ping Badge Fixes
  icon: bell-ringing-fill
  body: Channels no longer show a red ping badge for ordinary unread messages, and marking a channel as read reliably clears it.
  kind: fix
  -->

- ddfd10c: Fixes badge labels issuing one request per user. Every rendered name used to hit the labeler separately, so opening a large member list or a role mention popover fired dozens of requests at once. Names rendered without a badge no longer request one at all, the rest are coalesced into a single batched query, and a failed lookup no longer hides badges for fifteen minutes.

  <!-- whatsnew
  title: Faster member lists
  icon: lightning-fill
  body: Member lists and role popovers no longer stall while badges load.
  kind: fix
  -->

- 5383a82: Right-clicking or long-pressing a message author's avatar or name now opens the member menu instead of the message menu. The member menu hides role assignment and kick/ban for authors who are no longer part of the community, and message rows now highlight on desktop while their own menu is open, matching mobile.
- 0f3daca: Fixes the "Jump to latest" button in channels staying visible after being clicked

## 0.1.0-rc.14

### Minor Changes

- 979f968: Replaces the plain text loading screen with an animated hummingbird.

  The bird hovers with a photographic wing blur: ghost copies of each wing are sampled uniformly in time through a sinusoidal stroke, so they cluster at the stroke reversals and smear through the fast mid-stroke, with per-copy blur scaled to stroke velocity. Wings collapse along their own long axis rather than swinging, which keeps them at the side of the body where a real hummingbird's are. The hover-bob runs on its own clock, independent of the wingbeat.

  One bird now covers the whole boot instead of one per gate, so it stays on screen while sign-in hands off to the user load and then the community load, cycling status lines with bird-themed flavour in between. Wings beat lazily while connecting and settle into their resting tempo while syncing. After eight seconds the bird tires, slows its bob, sinks a little and switches to honest status lines. When everything is ready the status line fades out and the bird darts off screen. Tapping the bird startles it into hopping away from your finger with a burst of faster wingbeats.

  Reduced motion collapses all of it to the static artwork. The same bird also replaces the two floating logos on the homepage, hydrating on scroll and pausing when it leaves the viewport.

  <!-- whatsnew
  title: A hummingbird while you wait
  icon: bird-fill
  body: Loading screens now show a hovering hummingbird instead of plain text, with status lines that keep you company while the app starts up. Tap it if you want to see it startle.
  kind: feature
  -->

- 39a219f: Reworks how the app deals with things going wrong.

  <!-- whatsnew
  title: Better errors
  icon: warning-circle-fill
  body: When something goes wrong you now get a clear reason and a way to retry!
  kind: feature
  -->

- 7136be7: Rebuilds signing in and signing up as one flow, on one screen, at `/app/login` and `/app/register`.

  <!-- whatsnew
  title: A new way to sign in
  icon: sign-in-fill
  body: Our sign-in screen got reworked! Check if out when you have a chance.
  kind: feature
  -->

- 99e3e50: Colibri is exiting allowlist-gated early access. Anyone with an AT Protocol account can sign in now, and the join-the-waitlist prompts and download page are gone/back accordingly (the allowlist itself isn't removed, just switched off, so it can be re-enabled later if needed). To keep public channels safe, the first time you try to chat on a device you'll be asked to acknowledge a short guidelines notice (channels are public, don't share sensitive info) before your message goes out.

  <!-- whatsnew
  title: Open sign-in
  icon: chat-circle-dots-fill
  body: Sign-in is now open to everyone, no more waitlist.
  kind: feature
  -->

### Patch Changes

- e0a5e5f: Adds a toggle to allow you to display or hide the member list from inside a voice channel.
- 98c23f0: Leaving a community now also removes the join declaration stored on your account, so you no longer reappear in the community afterwards.
- 97bd8f3: Makes the app track the on-screen keyboard accurately on iOS.
- 3b27f31: Fixes other participants in a voice channel not hearing a sound when someone starts or stops screen sharing, or turns their camera on or off. Those sounds only played locally for the person toggling the feature; now they're also played for everyone else in the channel.

  <!-- whatsnew
  title: Screenshare and camera sounds for everyone
  icon: speaker-high-fill
  body: Other people in a voice channel now hear a sound when you start screen sharing or turn your camera on or off.
  kind: fix
  -->

- 36cc84a: Fixes the list of members shown in a voice channel being wrong: people who had already left lingering in the list, people who were connected missing from it, and mute or deafen badges disappearing. The member list the AppView returns when a community loads is now treated as the source of truth and re-applied whenever fresh data arrives, so a join or leave missed while the connection was down repairs itself instead of staying wrong for the rest of the session. This was most noticeable right after joining a community, where none of a channel's voice activity showed up at all.

  Also fixes leaving a call clearing everyone else's mute and deafen icons, moderator-applied server mutes not showing until the next voice event, and a member's voice channel from one community leaking into another community's sidebar.

  <!-- whatsnew
  title: Accurate voice channel member lists
  icon: users-three-fill
  body: Voice channels now show exactly who is in them, and keep it accurate through connection drops.
  kind: fix
  -->

- 8539830: Stops the unread-status seeding loop from endlessly re-requesting communities the AppView refuses, and stops reporting that refusal as a crash. A community that answers "not a member" is now parked for the session, logged with its URI as a breadcrumb, and picked up again as soon as a join event for it arrives.
- fa3a6a8: Fixes channels showing stale messages when you open the app. Busy channels never saved their history at all, so reopening one could show a conversation from days ago until the network caught up, and a message someone deleted while you were reading elsewhere would come back from the dead. Saved history is now kept current in the background for every channel, not just the one you have open, and anything older than a day is no longer shown as if it were current.

  <!-- whatsnew
  title: Faster, fresher messages
  icon: rewind-fill
  body: Channels now load up-to-date messages much sooner, and no longer show conversations that have fallen behind.
  kind: fix
  -->

- 0e459f3: Keeps popups out of the screen's safe areas on tablets.
- 7379b04: Only community members can send messages: the composer is disabled with a clear reason for anyone without an admission record, and accepting an invite now waits for the community to confirm the join before opening it.
- 99e3e50: Fixes the Settings dialog (and every other modal/popover/drawer built on the same primitive) rendering with clipped text and mis-centering on iPad-width screens, flagged during App Store review. Dialogs no longer size themselves off the viewport width, which was the root cause on tablet-sized screens, long channel names now truncate instead of overlapping the mute/member-list buttons at narrower chat widths.
- 93374b8: Fix voice channels failing to connect in the macOS app. When voice setup does fail, the app now clears the "Connecting" state and shows an error instead of spinning forever, and reports the failure so it can be diagnosed.

  <!-- whatsnew
  title: MacOS voice channel issues
  icon: speaker-high-fill
  body: MacOS users rejoice! You can finally join voice channels again.
  kind: fix
  -->

- 244c83e: Colibri on macOS, Windows and Linux now draws its own window title bar instead of using the plain system one, so the desktop app has the same branded header as the web app. The bar shows the community and channel you're in, and that same name is now what you see in the taskbar, in Alt-Tab and in Mission Control.
  There's a new "Use system window controls" switch in Settings under Preferences to go back to native controls.

  Also fixes the video viewer on desktop, which used a stand-in fullscreen mode that ignored Escape, and stops a trackpad pinch-zoom from shifting the whole app down.

  <!-- whatsnew
  title: A window title bar of our own
  icon: browser-fill
  body: The desktop app now has the same branded header as the web app, with the channel you're in shown in the title bar and the taskbar.
  kind: feature
  -->

- 99e3e50: Fixes voice calls silently breaking when something unrelated happened elsewhere in the app, e.g. switching to another app or device while on a call could make you vanish from the participant list and go unheard by everyone else, even though your own screen still showed you connected. Voice channel membership is now tracked from the actual voice connection instead of the general app connection, so it can no longer be knocked out by unrelated reconnects. Testing your microphone in Settings also no longer disconnects an active call on another device.

  <!-- whatsnew
  title: More reliable voice calls
  icon: speaker-high-fill
  body: Fixed a bug where activity elsewhere (like opening another device) could silently break your voice call without disconnecting you.
  kind: fix
  -->

- 618b27f: Fixes formatting markers being scrambled when a message is reopened for editing. A list item that started with an inline style came back inside out (`- **Test**` turned into `**- Test**`), which also corrupted the facets once the edit was saved. Headings and subtext were affected the same way whenever the inline style covered only part of the line, and copying a styled list item to the clipboard produced the same wrong text.

  <!-- whatsnew
  title: Editing formatted lists
  icon: list-bullets-fill
  body: Editing a message that contains a bold or italic list item no longer scrambles the formatting.
  kind: fix
  -->

## 0.1.0-rc.11

### Patch Changes

- 64fca4e: Fixes a few issues with console error spam
- 7058ba3: Fixes issues with banners: users were unable to remove pictures and banners, and banners in the UI wouldn't live-update.

  <!-- whatsnew
  title: Live Banner Updates
  icon: image-fill
  body: Updates made to a community's banner are now shown right away.
  kind: fix
  -->

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
