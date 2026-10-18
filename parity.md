# Old vs new client parity gaps

Old: `packages/client/src`. New: `packages/app/src` + `packages/ui/src`. Only open items are listed.

## Getting the new UI to testers

- [ ] Important: remove `packages/preview` and `packages/client` once testers run the new client and every item in "Before removing the old client" has shipped. The website's hummingbird and animation imports, the release notes scripts, CI and the website docs still depend on the old client. `parity-ext.md` lists each move.

## Before removing the old client

The new client must be fully functional before the old one goes. Every item here gates the removal.

- [ ] Custom emoji: verify on devices: upload (including a large animated GIF and the "Lower quality" prompt), rename and packs in Space settings, follow from a message, "My emoji packs", the live `emojiEvent`, and the re-consent screen for the new `blue.moji` repo scopes.
- [ ] Verify web push on spaces.colibri.social once the website deploys with `PUBLIC_VAPID_KEY` set: subscribe, receive a push, tap it to open the channel, and Mark as read from the worker.
- [ ] Verify on devices: native haptics (iOS, Android), notification taps (iOS, Android, including a tap that launches the Android app), Linux notification clicks and dismiss on read (`notifications/linux.rs`), and participant and stream volume above 100% in a real call.

## Native shell wiring

The wrapper already has the native side of each item. What's missing is the call from packages/app. `parity-ext.md` lists the wrapper commands and the old client call sites to port.

- [ ] Minor: verify the title bar extras on bundled builds: Windows snap layouts on the maximize button, the Windows system menu on right-click, and "Use system window controls" on macOS, Windows and Linux. Tested against a fake shell only.

## Voice

- [ ] Verify the camera icon and LIVE badge in the channel sidebar end to end once the AppView with lexicons 2.18.0 is deployed: one account turns on its camera, then shares its screen, and a second account that hasn't joined sees both appear and clear.

## Feature gaps

- [ ] Not launching with the new UI: Discover rejects with `NotEnabled` on the AppView. The code stays behind `DISCOVERY_ENABLED = false` for later.

## Settings

- [ ] Before the public release, not needed for testers: What's New is empty until the release notes move somewhere the app can import (proposal: the collect script also writes into `packages/lib`).


## Space hosting and migration (needs planning first)

- [ ] Important: bring your own Space host DID. The old client has it, disabled. The user signs in with a username and an app password, and Colibri operates the account.
- [ ] Important: take ownership of a Space host account hosted on our PDS, through a control in the Space settings.
- [ ] Important: convert pre-spaces communities to Spaces, carrying over most or all data. The old client has a migration, disabled.

## Infrastructure (needs discussion first)

- [ ] A global network of voice nodes and AppViews sharing one database, for lower latency.
- [ ] Store messages for users without Spaces support until Spaces arrive. Reference: HappyView.

## Standing decisions

- Drafts stay local to each device.
- Device-local, never synced: voice and video devices, volumes, noise suppression, voice gate, screen share options, per-participant volume, self mute and deafen, the native notifications toggle, prompt dismissals, window decorations, report attribution, pane sizes, the members pane, category collapse, last Space and channel.
- No "Start a thread" button in the composer. Header and menu entries are enough.
- Discover and invite links open the join screen only. No read-only Space preview.
- Kick stays available whenever the viewer has permission.
- Disguised links ask for confirmation even with the external link warning off.
- Delete my Colibri data removes the AppView data, the preferences space records and the profile record. Messages in other people's Spaces stay.
- `emoji://` and bundled twemoji aren't needed, the new client ships the COLR emoji font.
- The preview's `CallService` foreground service and `__colibriCall` bridge move into the wrapper with the switch (`parity-ext.md`).
