# @colibri-social/website

## 0.1.0-rc.13

### Minor Changes

- 9fe5418: Adds self-service account deletion

  <!-- whatsnew
  title: Data Deletion
  icon: trash-fill
  body: Adds an in-app data deletion option in the settings.
  kind: feature
  -->

- 05ecae5: Accept WebP community pictures and banners. The `social.colibri.community` lexicon now lists `image/webp` alongside JPEG, PNG and GIF, matching what profile avatars and banners already allowed.

  <!-- whatsnew
  title: WebP images
  icon: image-fill
  body: Community pictures and banners now accept WebP images.
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

- 5638113: Pin Biome to a single version across the workspace and CI.
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

## 0.1.0-rc.12

### Minor Changes

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

- 36cc84a: Fixes the list of members shown in a voice channel being wrong: people who had already left lingering in the list, people who were connected missing from it, and mute or deafen badges disappearing. The member list the AppView returns when a community loads is now treated as the source of truth and re-applied whenever fresh data arrives, so a join or leave missed while the connection was down repairs itself instead of staying wrong for the rest of the session. This was most noticeable right after joining a community, where none of a channel's voice activity showed up at all.

  Also fixes leaving a call clearing everyone else's mute and deafen icons, moderator-applied server mutes not showing until the next voice event, and a member's voice channel from one community leaking into another community's sidebar.

  <!-- whatsnew
  title: Accurate voice channel member lists
  icon: users-three-fill
  body: Voice channels now show exactly who is in them, and keep it accurate through connection drops.
  kind: fix
  -->

- 979f968: Swaps in the new paper-cut hummingbird as the app icon everywhere: desktop, iOS, Android, Windows, the favicons, the web app manifest, and the sign-in provider list.

  Android 13 and newer now get a monochrome layer, so launchers that tint icons to the wallpaper palette render Colibri properly instead of falling back to the untinted foreground. The adaptive foreground is also rendered separately at each density and inset to the safe zone, which fixes the beak and tail being clipped by round and squircle launcher masks. The status bar notification icon is redrawn from the same artwork.

  The three vector variants of the mark are committed under `packages/assets/brand`, and every raster target is rendered from them by `pnpm brand:render`, so the icon set is reproducible rather than a pile of hand-exported files. `favicon.svg` drops from 300 KB of base64-encoded PNG to a 15 KB vector along the way.

  <!-- whatsnew
  title: A new app icon
  icon: sparkle-fill
  body: Colibri has a new app icon, a paper-cut hummingbird. On Android 13 and newer it also picks up your wallpaper colours if your launcher tints icons.
  kind: feature
  -->

- 99e3e50: Fixes the Settings dialog (and every other modal/popover/drawer built on the same primitive) rendering with clipped text and mis-centering on iPad-width screens, flagged during App Store review. Dialogs no longer size themselves off the viewport width, which was the root cause on tablet-sized screens, long channel names now truncate instead of overlapping the mute/member-list buttons at narrower chat widths.
- 618b27f: Fixes formatting markers being scrambled when a message is reopened for editing. A list item that started with an inline style came back inside out (`- **Test**` turned into `**- Test**`), which also corrupted the facets once the edit was saved. Headings and subtext were affected the same way whenever the inline style covered only part of the line, and copying a styled list item to the clipboard produced the same wrong text.

  <!-- whatsnew
  title: Editing formatted lists
  icon: list-bullets-fill
  body: Editing a message that contains a bold or italic list item no longer scrambles the formatting.
  kind: fix
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

## 0.1.0-rc.11

### Patch Changes

- 7058ba3: Fixes issues with banners: users were unable to remove pictures and banners, and banners in the UI wouldn't live-update.

  <!-- whatsnew
  title: Live Banner Updates
  icon: image-fill
  body: Updates made to a community's banner are now shown right away.
  kind: fix
  -->

- Updated dependencies [64fca4e]
- Updated dependencies [7058ba3]
  - @colibri-social/client@0.1.0-rc.11

## 0.1.0-rc.10

### Minor Changes

- 1a88b5d: Add community banners

  <!-- whatsnew
  title: Community banners
  icon: image-fill
  body: Set a community banner to be displayed in the channel sidebar.
  kind: feature
  -->

### Patch Changes

- 0de7ee1: Fixes drag/drop handling issues with channels

  <!-- whatsnew
  title: Improved Drag/Drop Handling
  icon: hand-grabbing-fill
  body: Issues with dragging and dropping channels on Desktop should be resolved now.
  kind: fix
  -->

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

## 0.0.2-rc.9

### Patch Changes

- 5258c62: Fixes issues related to FCM notifications and pings in-app
- Updated dependencies [e7d5e80]
- Updated dependencies [1a0b6b5]
- Updated dependencies [5258c62]
- Updated dependencies [5258c62]
  - @colibri-social/client@0.1.0-rc.9

## 0.0.2-rc.8

### Patch Changes

- 764a8bc: Adds new badge types, a preferred badge selector, and a support page
- 1cde6b4: Gates allowed DIDs to an allowlist for sign ins and hides sign-up
- 85385b3: Makes cross-appview voice channels work
- 32fd184: Improves emoji handling by serving images locally instead of relying on CDN
- 9faa84c: Adds single-user voice exclusivity.
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

## 0.0.2-rc.7

### Patch Changes

- abc0d59: Adds better emoji handling and twemoji fallbacks
- 171968c: Adds native FCM notifications for Android apps
- 297bf92: Adds support for web push notifications for all messages
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

## 0.0.2-rc.6

### Patch Changes

- 7696331: Adds support for team and play store tester labels and auto updating on supported platforms
- 7696331: Adds support for custom badges and auto-updating where supported, and fixes an issue where mobile invite modals would overflow
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

## 0.0.2-rc.5

### Patch Changes

- df106e7: Adds a missing permission to the permission set
- Updated dependencies [df106e7]
- Updated dependencies [8ddea05]
- Updated dependencies [75bfff8]
- Updated dependencies [5855f50]
- Updated dependencies [7ae9314]
- Updated dependencies [3f1f55d]
- Updated dependencies [0ec83ae]
  - @colibri-social/client@0.0.1-rc.5

## 0.0.2-rc.4

### Patch Changes

- Updated dependencies [5480a4d]
- Updated dependencies [a7ca279]
- Updated dependencies [2cdb3cf]
  - @colibri-social/client@0.0.1-rc.4

## 0.0.2-rc.3

### Patch Changes

- Updated dependencies [e48ba9b]
  - @colibri-social/client@0.0.1-rc.3

## 0.0.2-rc.2

### Patch Changes

- Updated dependencies [17e109e]
- Updated dependencies [5cdb331]
- Updated dependencies [3560f64]
  - @colibri-social/client@0.0.1-rc.2

## 0.0.2-rc.1

### Patch Changes

- Updated dependencies [b315479]
- Updated dependencies [bf105c0]
  - @colibri-social/client@0.0.1-rc.1

## 0.0.2-rc.0

### Patch Changes

- c30cba7: fix: Padding issues on Android devices
- 24ce2db: feat: Sentry releases setup
- Updated dependencies [c30cba7]
- Updated dependencies [2ceec79]
  - @colibri-social/client@0.0.1-rc.0
  - @colibri-social/standard-renderer@0.0.2-rc.0
