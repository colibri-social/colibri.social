# @colibri-social/client

## 0.3.0

### Minor Changes

- 489026a: Profile badges are now defined by the labeler instead of being hardcoded in the client. The labeler publishes its badge catalogue as a `social.colibri.labeler.service` record, and the client reads it at runtime, so adding a badge or recolouring one no longer needs a client release. Every piece of badge display metadata used to be duplicated across three hand-maintained maps in the client plus the labeler's own list, and the copies could drift.

  `#badgeDefinition` gains an optional `appearance` holding a `variant` of `solid` or `gradientBorder`, a list of `colors` and a `foreground`. Every colour is a `#rrggbb` or `#rrggbbaa` hex literal, validated on the way in, so a badge's colours reach the DOM as an inline style without the record being able to inject arbitrary CSS. A badge whose appearance is missing or unusable still renders, with the neutral fallback style.

  The catalogue is read from the labeler's own PDS, cached for an hour in memory and IndexedDB, and backed by a bundled copy of the current badges, so badges render immediately on a cold start and keep rendering if the labeler is unreachable. A badge the record lists without an appearance keeps its bundled colours rather than dropping to the neutral style, so nothing changes appearance until the labeler actually publishes new colours. The `Badge` component now takes just the label value and looks up its own text, description and colours.

- 1f3ab7f: Adds control over link previews at every level. Authors can hide the preview on a link they posted, one at a time or all at once, and bring it back later. A new dismiss button appears on hover over a preview card, and a Link Previews entry in the message menu lists every link so previews can be reviewed and restored. A toggle in the composer sets whether previews are attached before a message is sent, seeded from a new preference for what that toggle should default to.

  Moderators holding `message.hide` get the same per-link control through two new procedures, `social.colibri.community.suppressMessageEmbeds` and `unsuppressMessageEmbeds`, recorded on the community's moderation log. Author and moderator suppression are tracked separately and each side can only undo its own, so a moderator can never restore a preview its author chose to hide, and an author can never restore one a moderator hid.

  Community owners can turn previews off for a whole community from a new Messages section in community settings, and each channel can override that with its own show, hide, or follow-the-community setting. Turning previews off applies to messages already in the channel and skips fetching their metadata entirely.

  Inline images and GIFs are unaffected.

  <!-- whatsnew
  title: Turn off link previews
  icon: link-break-fill
  body: Hide the preview card on any link you post, one at a time or all of them, and change your mind later. Moderators can hide previews too, and community owners can switch them off per community or per channel.
  platforms: all
  kind: feature
  -->

- ff1ce5f: Quick reactions now follow the emoji you actually use. The client keeps a local tally of every emoji you react with, ranked by how often you use it and broken by which you reached for most recently, and both reaction shortcuts read from that tally. Defaults fill any gaps, so the rows look complete before you have reacted to anything.

  <!-- whatsnew
  title: Quick reactions learn your favourites
  icon: smiley-fill
  platforms: all
  kind: feature
  body: Your most-used emoji now sit in the message action bar on desktop and in the long-press drawer on touch.
  -->

- 3f13c9f: Fixes desktop notifications never appearing and adds an unread badge to the macOS dock. The notification plugin always reports permission as granted on desktop, so the code that switches notifications on after a successful prompt never ran and the setting stayed off unless you found the toggle in settings yourself. Desktop now opts in once on first launch, and turning it off still sticks. In-app toasts also stopped appearing entirely once notifications were on, even with the window focused, so those are back whenever the window is in front. On macOS notifications are now delivered through the system notification centre: they carry the sender's avatar, group per channel, open the right message when clicked, and disappear once the message is read. Windows notifications are now native toasts carrying the sender's avatar that open the right message when clicked. Windows does not group by channel and does not clear a toast once the message is read, since the toast API exposes no way to do either.

  <!-- whatsnew
  title: Desktop notifications
  icon: bell-ringing-fill
  body: Desktop notifications no longer need to be switched on by hand, and on macOS and Windows they show the sender's avatar and take you straight to the message. Your unread mention count now shows on the macOS dock icon.
  platforms: desktop
  kind: feature
  -->

- e6787f9: Right-clicking a link now offers actions for that link. Every message body is wrapped in a single context menu trigger, so a right-click anywhere in a message, including on a URL, used to open the message menu with nothing but Reply, Copy Text and Delete. There was no way to copy a link without selecting its text by hand.

  The menu now leads with Open Link and Copy Link when the pointer is over one, followed by a separator and the usual message actions below. This covers links in message text, link card and Bluesky embed titles, hashtags, channel links and invite links. A channel or invite link copies as a full shareable URL rather than the internal path. Attachment links are left alone, since their download URLs are meaningless outside the session.

  Mentions now open the member menu instead, the same one the member list and the message author give you, so roles, moderation actions and Copy DID are reachable from a mention without hunting for that person in the sidebar. Every entry stays permission gated exactly as it was, and nothing message-related appears there.

  Long-pressing a message on touch leads with the same two link actions in the drawer, and long-pressing a mention opens the member drawer. Profile popovers gained a link menu of their own for bio links and the client links next to the handle.

  <!-- whatsnew
  title: Right-click a link, get link actions
  icon: link-simple-fill
  platforms: all
  kind: feature
  body: Right-click or long-press a link to open or copy it, without hunting for the message menu or selecting the text by hand.
  -->

- 6381845: Moderating a community hosted on a different AppView now works. Only the AppView holding a community's credentials can write to its repo, so until now banning, kicking, hiding a message, approving a join, leaving, or editing channels, categories, roles and settings all failed if you were signed in to a different AppView than the one hosting that community. The failure surfaced as a generic server error that got retried eight times before giving up, because nothing recognised it as a permanent routing problem. Your AppView now recognises that a community belongs to another one and forwards the request there on your behalf, returning that AppView's own answer. Your browser only ever talks to your own AppView, so the one hosting the community never sees your connection.

  The AppView you use is published on your public profile when presence sharing is on, and the AppView hosting a community checks it before accepting anything on your behalf, so nobody else's AppView can act as you. That means presence sharing has to be on to moderate a community hosted elsewhere. The presence setting and AppView picker now say so, the member and banned-user screens of a community hosted elsewhere warn you up front if you can moderate it but have presence sharing off, turning the setting off warns you that it breaks moderation elsewhere and offers to undo, and if an action is refused for that reason you get a prompt to turn it back on, once per session, with a button to stop showing it.

  Also fixes an AppView that no longer administers a community being able to keep writing to it with credentials it still held, and two error codes that were declared to clients but could never actually be sent.

  <!-- whatsnew
  title: Moderation across AppViews
  icon: shield-check-fill
  body: You can now moderate and manage communities hosted on a different AppView than the one you signed in to. This needs presence sharing on, which is what tells other AppViews yours is allowed to act for you.
  platforms: all
  kind: feature
  -->

- 489026a: Supporter badges are now self-service. Settings then Support gains a "Connect Open Collective" step: authorize once, and the matching badge is granted within seconds, kept in step with the contribution, and revoked when it lapses. Until now every supporter badge was handed out by a maintainer running a CLI, which contributors had started working around by pasting their DID into their Open Collective display name.

  The link is published as a `social.colibri.labeler.attestation` record in the labeler's own repo, keyed by the subject DID, rather than kept in a private table. It is on-protocol, publicly auditable, replicated like any other record, and resolvable with a single `getRecord`. The OAuth `state` is a self-signed short-lived token, so the flow stores nothing anywhere.

  Reading contributions needs no authentication, because a collective's orders are public. OAuth is used only to prove which Open Collective account the user controls: the access token is used once to read the account, then thrown away, and no refresh token is kept.

  Entitlement is decided by amount rather than by Open Collective tier. The collective only has a $5 and a $25 tier, both flexible, so a $10 contributor arrives on the $5 tier at a custom amount or with no tier at all, and matching on tier would quietly underpay them. Yearly contributions are divided by 12, several active contributions are summed, and a currency the collective does not use is skipped rather than guessed at. The Support page also gains the `$10 SUPPORTER` tier, which it was missing.

  A lapse is caught two ways. Every pass reissues the badge with an expiry a grace period past the next charge date, so badges lapse on their own if the sync ever stops running, and a contribution that goes inactive also gets an immediate negation. One-time `DONATOR` badges are permanent.

  Badges granted by hand before any of this existed are safe. Labels are append-only, so linking adds a row rather than replacing one, and reconciliation never revokes a badge that carries no expiry, which is what distinguishes a maintainer's deliberate grant from one the sync issued. Linking can only add or upgrade, so nobody loses a badge by connecting their account. Badges outside the supporter set are never read by the sync at all.

  Guest profiles need no manual auditing. A guest profile has no credentials so it cannot complete the flow at all, and claiming one converts it in place while keeping the contribution attached, so anyone who does reach the callback is already a claimed account. The Support page says so and links to the claim flow, and each sync reports how many contributions came from unclaimed guest profiles.

  Linking adds two `rpc:` scopes, so existing sessions are asked to reauthorize before the new buttons work.

  <!-- whatsnew
  title: Claim your supporter badge
  icon: heart-fill
  platforms: web,windows,linux
  kind: feature
  body: Contributing on Open Collective? Connect your account under Settings then Support and your badge appears on its own.
  -->

### Patch Changes

- 44e7e4d: The experimental Appearance setting gained a System option.

  <!-- whatsnew
  title: Appearance can follow your system
  icon: circle-half-fill
  body: The experimental Appearance setting now lists System alongside Dark and Light.
  platforms: all
  kind: feature
  -->

- 6257430: File attachments now download instead of opening in your browser. A text file, a JSON file or an SVG used to be handed straight to the browser, which rendered it inline rather than saving it, and in the desktop and mobile apps it opened in an external browser tab instead. Every download button now saves the file under the name it was uploaded with, on web, desktop and mobile alike.

  Images gained download buttons where there were none. Previously only a single attached image had one, so an image posted as part of a set of several could not be saved at all. Every image in a gallery now reveals its own download button on hover, and the fullscreen viewer has one too, which is the way to save an image on a touch screen.

  <!-- whatsnew
  title: Attachments actually download
  icon: download-simple-fill
  body: Text files, documents and images now save to your device under their original filename instead of opening in a browser tab.
  platforms: all
  kind: fix
  -->

- 46afe30: The "Jump to latest" button now appears whenever you are scrolled away from the newest message, instead of only when you scroll up past a fixed point in the list. Opening a channel that lands you on an older message, whether from an unread marker, a notification, or a reply you followed, now shows the button straight away rather than leaving you to find your own way back down.

  It also shows up in two places it never used to: when you are only a few messages from the end but still not at the bottom, and in short channels where a handful of tall messages with images can already fill more than a screen. Tapping it now clears the "New messages" divider in the same step, so it no longer lingers above you after the jump.

  <!-- whatsnew
  title: Jump to latest always finds you
  icon: arrow-line-down-fill
  body: The button now appears whenever you are scrolled away from the newest message, including when a channel opens on an older message from an unread marker or a notification.
  platforms: all
  kind: fix
  -->

- 1c16781: The settings button now sits next to your profile at the bottom of the channel sidebar instead of under the community rail, which puts it where you already look for your own account. The status bar around it got tighter too: the row is shorter, the avatar smaller, and long display names are clamped so they can no longer push the row sideways. On the home screen, where there is no channel sidebar, the gear stays in the rail.

  <!-- whatsnew
  title: Settings moved next to your profile
  icon: gear-fill
  platforms: all
  kind: feature
  body: The gear now lives beside your avatar at the bottom of the channel list, and that whole status bar is a bit more compact.
  -->

- 17bc302: Staying pinned to the bottom of a channel is no longer a matter of luck. Sending a message reliably scrolls you down to it, and on mobile the list now keeps up with the chat input as it grows from one line to five, and with the keyboard as it slides in and out.

  The old behaviour guessed at whether you wanted to be at the bottom by looking at where the list happened to sit whenever it received a scroll event. Growing the chat input never produces one, so a single unlucky guess earlier in the session would leave the newest message sliding out of sight behind the composer, with nothing able to correct it. Whether you were pinned is now something the app records when you actually ask for it, by sending a message, by tapping "Jump to latest", or by ending a scroll near the bottom, and it holds that position across the several frames it takes images, link previews and quoted posts to settle.

  Deleting a message no longer strands the list either. Previously, if the deleted message was the one the list was holding on to, every later correction silently stopped working for the rest of the session. Bluesky quotes, GIFs and link previews now also reserve their height before they load, so messages arriving underneath you push the view around far less.

  <!-- whatsnew
  title: Channels stay pinned to the bottom
  icon: arrow-down-fill
  body: Sending a message now reliably scrolls you to it, and the list keeps its place as the chat input grows and the keyboard opens.
  platforms: all
  kind: fix
  -->

- 90d61ff: Android push notifications now carry a "Mark as read" button, and author avatars in them are round instead of square.

  <!-- whatsnew
  title: Mark conversations read from the notification
  icon: checks-fill
  platforms: android
  kind: fix
  body: Notifications now have a "Mark as read" button that clears the conversation without opening the app, and author avatars in them are finally round.
  -->

- 75e5b3b: Scopes What's New entries to the platforms they apply to. Every whatsnew block in a changeset now carries a required `platforms:` key holding a comma-separated list of `web`, `ios`, `android`, `macos`, `windows` and `linux`, with `all`, `mobile` and `desktop` as shorthands. The in-app popup and the What's New settings page render only the entries that name the platform the app is running on, and the App Store and Play release notes are rendered per platform through a new required `--platform` flag, falling back to a generic line when a release has nothing for that store.
- e9abd8a: Link previews now show a small image beside the text unless the page explicitly asks for a large one, and they respect the image size a page publishes.

  <!-- whatsnew
  title: Tidier link previews
  icon: image-fill
  platforms: all
  kind: fix
  body: Links that only carry a small image now show it as a thumbnail next to the title, and large previews no longer tower over the message.
  -->

- 85017b9: Opening a community you have already visited no longer replays the loading screen. The app now keeps the last few communities in memory and shows them straight away while it checks for anything new, so switching in from the home screen is instant instead of flashing the startup animation for half a second.

  Losing your connection while reading a community also no longer throws you out. A failed refresh used to replace the whole view with an error screen, even though the messages and member list on screen were still perfectly good. Now you stay where you are, a note tells you that you are looking at saved data, and the app quietly keeps retrying in the background until it gets through. Communities that have genuinely been deleted or that you no longer have access to still close as before.

  <!-- whatsnew
  title: Communities open instantly
  icon: lightning-fill
  body: Switching into a community you have already visited no longer replays the loading screen, and a dropped connection keeps you where you are instead of dumping you on an error screen.
  platforms: all
  kind: fix
  -->

- 5a1dfea: Scrolling to the top of a channel no longer runs away. The scroll surface identified message rows by an attribute that sits below the row element, so every anchor capture came up empty and restoring the reading position after older messages mounted was a silent no-op. The reader stayed at the top, which immediately asked for the next page, and the messages they were reading were pushed down out of view. Rows are now resolved through their wrapper elements, older pages are compensated even while a scroll gesture is still running, late-loading embeds above the fold no longer shift the view mid-scroll, and the self-driven prefetch chain stops instead of spinning if a page ever fails to compensate. The backfill cursor also advances past the whole fetched page now, so overlapping pages cannot cause round-trips that make no progress.

  <!-- whatsnew
  title: Scrolling up through history stays put
  icon: arrow-up-fill
  platforms: all
  kind: fix
  body: Older messages now load in directly above the oldest one you have, with no jump and no runaway loading when you reach the top of a channel.
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

- d6d1f9d: Makes the channel sidebar resizable on desktop. Its right edge is now a drag handle that resizes the sidebar between 200px and 360px, and the chat area next to it follows along. The chosen width is remembered across sessions and applies to every community. The handle shows nothing until the pointer rests on the edge for a moment, at which point the border thickens to signal it can be dragged, and double-clicking it restores the default width. It can also be moved with the arrow keys once focused.

  Also fixes the community name in the sidebar header never reflowing. It was sized to its own text with no overflow handling, so a long name pushed past the sidebar instead of truncating. It now grows and shrinks with the sidebar and ends in an ellipsis when there is not enough room.

  <!-- whatsnew
  title: Resizable channel sidebar
  icon: sidebar-fill
  body: Drag the right edge of the channel sidebar to make it wider or narrower. Double-click the edge to put it back.
  platforms: desktop
  kind: feature
  -->

## 0.2.1

### Patch Changes

- f176caa: Fixes two crashes. Stopping a native screen share no longer errors out when the capture ends by itself at the same moment, and a long press on mobile can no longer crash the app when the screen holding the pressed item goes away while your finger is still down.
- 180802f: Address the Play Console and App Store Connect recommendations: raise the iOS deployment target to 15.0, load notification images through Glide so they are downsampled and cached instead of decoded at full resolution, enable resource shrinking for Android release builds, and drive edge-to-edge from theme attributes so the system bar icons follow the app theme.
- f176caa: Fixes a class of crashes in the message list, stops a pointless permission-denied request, and cuts the number of badge lookups a channel makes.
- f176caa: Makes error tracking group failures by what went wrong rather than by the exact wording of the message. One fault could previously show up as several separate entries whenever the server included something variable in its reply, such as a session identifier or a link, which made a single problem look like many and hid how often it really happened. Unknown failures still separate by where they came from, so nothing distinct gets merged.
- f176caa: Stops reporting expected outcomes as errors. A link preview whose site is down, a community that was deleted while it was still the last one you visited, a handle typed into the sign-in field that does not resolve, a declined microphone prompt, a camera another app is already using and a dropped connection were all being sent to error tracking as faults. Each of those still surfaces in the UI, but none of them is a bug in the app, and together they buried the failures that are. Joining a voice channel now also refuses up front on systems whose web engine was built without WebRTC, instead of failing partway through setup.
- f176caa: Community picture and banner pickers now only offer the image formats the server stores, and say so right away when a file cannot be used, instead of letting the upload fail at the end of creating a community. Android devices that cannot reach Google's push service while registering for notifications now retry quietly rather than raising an error.
- 467f933: Fixes the sign-in screen not resizing with the on-screen keyboard on Android. The viewport height accessor only subscribed to the visual viewport, which Android never resizes for the keyboard because the window is edge to edge. Consumers now also track the native keyboard inset, so the sign-in screen, the handle typeahead and the channel scroll anchor follow the keyboard on Android the same way they already did on iOS.

  <!-- whatsnew
  title: Keyboards on Android
  icon: keyboard-fill
  body: The sign-in screen now moves out of the way when the keyboard opens, for real this time.
  kind: fix
  -->

- f176caa: Checking whether the desktop and mobile apps are allowed to show notifications can no longer crash the page it happens on. When the operating system refuses that check, the app now treats notifications as switched off and carries on, instead of surfacing an unexplained failure. In-app messages still appear as before.
- f176caa: Ignores incomplete cached community data when opening a community. A cache entry written by an older version of the app could be missing its channel, role or member lists, which made parts of the community screen fail to render until a reload.
- f176caa: The microphone test in Voice settings now tells you when it cannot open an input device instead of failing silently and leaving the test button stuck. Picking a different noise suppression mode while the test is running recovers the same way.

  Unread badge polling and the community list also stop treating an ordinary dropped connection as a fault worth reporting, so a brief loss of signal no longer fills the error log with noise.

- 467f933: Adds a way back in when a session ends, and detects that it has ended in the first place. The app used to show a loading screen reading "Not logged in!" with no button on it, paired with an automatic redirect to the sign-in screen that silently stranded anyone whose navigation never landed. There is now a real screen with a sign-in button, and the redirect is gone.
- f176caa: Stop treating a dropped connection while opening a channel as a crash worth reporting. The channel already shows a retry when it cannot be loaded, so a request that times out or never leaves the device no longer files an error report as well.
- f176caa: Fixes a dead session going unnoticed. When a sign-in ends for good, the underlying library reports it with an error that carries no name, so the app read every one of those as an unknown failure and kept trying: requests fired on every resume, each one failed, and nothing ever said why. Those sessions are now recognised, so you get the sign-in screen instead of an app that looks online and quietly does nothing. Sessions are also written to disk more carefully, which should stop some of them from ending early in the first place.

## 0.2.0

### Minor Changes

- 57f95ee: Prompt web users once after logging in to enable notifications, with a dialog that requests browser permission and registers web push on accept. Also shrink the badges in the profile card to the same size used in messages.
- 1a88b5d: Add community banners

  <!-- whatsnew
  title: Community banners
  icon: image-fill
  body: Set a community banner to be displayed in the channel sidebar.
  kind: feature
  -->

- 9c7af6d: Adds configurable swipe controls on mobile apps and the web
- 9ae0edd: Adds an experimental light mode. Enable "Light mode" in Settings → Experiments and an Appearance selector shows up under Preferences. It follows your system appearance until you pick Dark or Light yourself, after which your choice sticks.

  <!-- whatsnew
  title: Light mode (experimental)
  icon: sun-fill
  body: Turn on "Light mode" in Settings → Experiments to get an Appearance setting under Preferences. Colibri follows your system by default and remembers your choice once you pick one. It's early, so expect some rough edges.
  kind: feature
  -->

- 5d90118: Adds a debug information section to the About settings page, with a button to copy everything (app/build, device, account, and runtime state) as a paste-ready block. Web builds now also report a real client version and commit instead of just "Web".

  <!-- whatsnew
  title: Debug Information
  icon: bug-fill
  body: The "About" page in the settings now contains debug information that can easily be copied.
  kind: feature
  -->

- 9dc8d8f: Add screen share quality settings and screen audio

  Screen sharing now has a pre-share dialog for picking resolution (720p, 1080p, 1440p or source) and frame rate (15, 30 or 60), plus a dropdown next to the share button for changing quality while already streaming. Streams can now carry sound from the captured tab or screen where the browser engine supports it, with its own per-participant volume slider separate from the person's voice. Quality choices map to capture constraints, a content hint, a bitrate ceiling and a degradation preference, so a low frame rate now favours a sharp picture.

  On Windows and MacOS, the app also displays a proper Application/Window/Screen picker.

  <!-- whatsnew
  title: Screen Share Improvements
  icon: monitor-play-fill
  body: The Windows and MacOS apps have gained an app/window/screen picker, plus you're able to share stream audio and change the stream's quality on any device.
  kind: feature
  -->

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

- 2607072: Reworks noise suppression into strength tiers. Behind a new Experiments toggle, three research denoisers are also selectable: **Experimental (DTLN)**, **Experimental (GTCRN)** and **Experimental (UL-UNAS)**. They run at 16 kHz through a shared resampling host and only download their models when one is picked.

  <!-- whatsnew
  title: Experimental noise suppressors
  icon: waveform-fill
  body: Enable the "Noise suppression" experiment to try out three new noise cancelling algorithms!
  kind: feature
  -->

- 7136be7: Rebuilds signing in and signing up as one flow, on one screen, at `/app/login` and `/app/register`.

  <!-- whatsnew
  title: A new way to sign in
  icon: sign-in-fill
  body: Our sign-in screen got reworked! Check if out when you have a chance.
  kind: feature
  -->

- 9fe5418: Adds self-service account deletion

  <!-- whatsnew
  title: Data Deletion
  icon: trash-fill
  body: Adds an in-app data deletion option in the settings.
  kind: feature
  -->

- fd0c7c7: Adds a "What's New" popup that appears once per release, listing the features and fixes that shipped, plus a settings page with the last five releases.

  <!-- whatsnew
  title: What's New popup
  icon: sparkle-fill
  body: This popup you're seeing!
  kind: feature
  -->

- 3c54a9a: Turn pasted channel links into channel facets, render them across communities, and add a copy channel link action

  <!-- whatsnew
  title: Channel Links
  icon: link-simple-fill
  body: Paste a channel link and it turns into a channel chip. Links to channels in your other communities show that community's icon, links to communities you are not in show as no access, and you can right-click any channel to copy its link.
  kind: feature
  -->

- 99e3e50: Colibri is exiting allowlist-gated early access. Anyone with an AT Protocol account can sign in now, and the join-the-waitlist prompts and download page are gone/back accordingly (the allowlist itself isn't removed, just switched off, so it can be re-enabled later if needed). To keep public channels safe, the first time you try to chat on a device you'll be asked to acknowledge a short guidelines notice (channels are public, don't share sensitive info) before your message goes out.

  <!-- whatsnew
  title: Open sign-in
  icon: chat-circle-dots-fill
  body: Sign-in is now open to everyone, no more waitlist.
  kind: feature
  -->

- 5262109: Emoji shortcode suggestions now match keywords, so typing ":salute" suggests the saluting face even though its shortcode is "saluting_face". Results are ranked by match quality instead of alphabetically, up to ten suggestions are shown, each emoji appears only once, and the emoji picker search also matches keywords.

  <!-- whatsnew
  title: Smarter emoji suggestions
  icon: smiley-fill
  body: Typing ":" now suggests emojis by keyword, not just by exact name.
  kind: feature
  -->

### Patch Changes

- 9f5b509: Makes multiple improvements to the way drawers are handled:
  - Drawers now fade instead of hard-cut at the bottom to indicate whether the user can scroll
  - Drawers have better gesture support (back gesture closes them)
  - Drawers can be extended up if they're scrollable by dragging the handle
  - All drawers use the same system now

- e7d5e80: Fixes issues related to swipe controls
- abc0d59: Adds better emoji handling and twemoji fallbacks
- cfabe53: Improves mention handling in the text editor and user bio
- ce7d4d5: Add login telemetry
- c30cba7: fix: Padding issues on Android devices
- e0a5e5f: Adds a toggle to allow you to display or hide the member list from inside a voice channel.
- b315479: Enables notifications for native builds by default
- 7f4ad84: Fixes a crash that would occur when leaving a VC soon after disabling a camera/screen share.
- 2ceec79: fix: Show loading screen instead of login screen on oauth redirect
- 536b3a3: Adds custom scrollbar styling
- 171968c: Adds native FCM notifications for Android apps
- 0de7ee1: Fixes drag/drop handling issues with channels

  <!-- whatsnew
  title: Improved Drag/Drop Handling
  icon: hand-grabbing-fill
  body: Issues with dragging and dropping channels on Desktop should be resolved now.
  kind: fix
  -->

- 764a8bc: Adds new badge types, a preferred badge selector, and a support page
- 1a0b6b5: Optimizes image loading for Avatars with a new "size" prop and better HTML attributes
- 5480a4d: Fixes drawer behavior on mobile devices
- 835198b: Fixes swiping/dragging functionality as well as padding inconsistencies
- 342ee16: Fixes an issue on mobile devices that would cause the chat input to gradually be shown over the latest message and eventually "un-pin" the channel view if lots of text were to be inputted.
- 66c6c75: Rework channel message scrolling around a single anchor controller

  <!-- whatsnew
  title: Smoother Older Message Loading
  icon: arrow-line-up-fill
  body: Scrolling up to load older messages in a channel no longer jumps your view around, and late-loading images no longer shift what you are reading.
  kind: fix
  -->

- 17e109e: Swaps the mobile settings drawer select chevron to an SVG controlled by us and hides the duplicate title.
- 64fca4e: Fixes a few issues with console error spam
- 32714ae: Shows the "Jump to latest" button in a channel much sooner.

  <!-- whatsnew
  title: Jump to latest appears sooner
  icon: arrow-line-down-fill
  body: The "Jump to latest" button in a channel now shows up as soon as you scroll a short way up, instead of only after scrolling a long way.
  kind: fix
  -->

- 0b6cd46: Makes touch interactions work on tablets
- a924645: Adds better handling for links to images and image uploads as well as videos on mobile
- 98c23f0: Leaving a community now also removes the join declaration stored on your account, so you no longer reappear in the community afterwards.
- 0eea035: Makes a community's "settings" option only available to users who are allowed to change things, makes all links open in a browser instead of in-app for native apps, fixes mobile edit behavior, ensures login autocomplete always shows above keyboard
- 6cb2c4f: Fixes issues related to messages not being displayed and invalid notification counts
- 97bd8f3: Makes the app track the on-screen keyboard accurately on iOS.
- fa5297b: Adds clipboard support for iOS and Android
- 3b27f31: Fixes other participants in a voice channel not hearing a sound when someone starts or stops screen sharing, or turns their camera on or off. Those sounds only played locally for the person toggling the feature; now they're also played for everyone else in the channel.

  <!-- whatsnew
  title: Screenshare and camera sounds for everyone
  icon: speaker-high-fill
  body: Other people in a voice channel now hear a sound when you start screen sharing or turn your camera on or off.
  kind: fix
  -->

- 857aa9e: Recovers from a dropped local database during sign-in on iOS. iOS shuts down the storage the app keeps its session in whenever the app spends time in the background, which is exactly what happens while the sign-in sheet is open. The app now reopens that storage instead of failing every read for the rest of the session, and a slow read while starting up no longer signs you out.

  <!-- whatsnew
  title: Reliable Sign-In on iOS
  icon: key-fill
  body: Signing in on iPhone and iPad no longer gets stuck when the app is in the background during the sign-in sheet, and a slow start-up no longer signs you out.
  kind: fix
  -->

- 9364086: Makes GIF favorites reachable on touch devices. The star on a GIF was only ever drawn on hover, so on a phone it never appeared and the Favorites tab could only be filled from a desktop. In the picker the star is now always visible on touch, with a tap target sized for a thumb, and pressing and holding a GIF toggles the favorite without sending it. GIFs already posted in a chat pick up a "Save GIF" entry in the message long-press menu, which avoids stacking a second hidden gesture onto the message row.

  <!-- whatsnew
  title: Save GIFs from your phone
  icon: star-fill
  body: The star on a GIF now shows up on touch, so you can build your favorites list without reaching for a desktop. Press and hold a GIF in the picker to save it, or use Save GIF in the message menu for one someone already posted.
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

- 1cde6b4: Gates allowed DIDs to an allowlist for sign ins and hides sign-up
- 85385b3: Makes cross-appview voice channels work
- a7ca279: Fixes a stale read error and undefined read in the community context and channel layout.
- d526785: Fixes for iOS and macOS login flows
- 795f9c7: Remove deleted messages from the offline message cache instead of keeping them until the channel is next opened
- 9b84667: Place incoming messages by their timestamp instead of their delivery order, so backfilled history no longer lands at the bottom of a channel.
- 5258c62: Fixes Homebrew installs failing to launch on macOS with "the application is damaged and can't be opened".

  The Homebrew cask wrote an install-channel marker into `Colibri Social.app/Contents/Resources/`, which invalidated the app bundle's code signature. Since Homebrew quarantines the app, Gatekeeper rejected it on first launch. Homebrew installs are now detected via the Caskroom directory instead, so nothing touches the signed bundle.

- 9aaad31: Classifies wrapped network failures correctly and only shows a reference for reports that reached us
- 702c3ae: Fixes iOS app issues related to login and padding
- f1597ae: Automatically dismisses notifications if a channel is opened and the notification is still there.
- 32fd184: Improves emoji handling by serving images locally instead of relying on CDN
- 5258c62: Fixes issues related to FCM notifications and pings in-app
- df106e7: Fixes missing padding in the settings modal
- cd33c8c: Improves the attachment experience for multi-attachment messages, mobile, and message sending
- 9faa84c: Adds single-user voice exclusivity.
- bf105c0: fix: Move reconnecting indicator below top bar
- 7058ba3: Fixes issues with banners: users were unable to remove pictures and banners, and banners in the UI wouldn't live-update.

  <!-- whatsnew
  title: Live Banner Updates
  icon: image-fill
  body: Updates made to a community's banner are now shown right away.
  kind: fix
  -->

- b1536c7: Signs in inside the app on iOS. The authorization page now opens in a native web authentication sheet, the same one macOS already used, instead of switching over to Safari and waiting for a deep link to come back. If the sheet cannot be presented, the old browser handoff still takes over.
- b1536c7: Lifts the sign-in pane above the on-screen keyboard on tablets. The two-pane layout centred its form in the full window height, so in landscape the keyboard covered the handle input while it was being typed into. The pane now centres in the space the keyboard leaves, following the same spring the keyboard animates with.
- df806af: Show the channel loading states ("Loading messages", "Loading older messages", "Catching up") as a floating pill over the message list instead of an in-flow line at the top, so the conversation no longer shifts when they appear or disappear. The pill is now shared with the reconnecting indicator.
- 8539830: Stops the unread-status seeding loop from endlessly re-requesting communities the AppView refuses, and stops reporting that refusal as a crash. A community that answers "not a member" is now parked for the session, logged with its URI as a breadcrumb, and picked up again as soon as a join event for it arrives.
- fa3a6a8: Fixes channels showing stale messages when you open the app. Busy channels never saved their history at all, so reopening one could show a conversation from days ago until the network caught up, and a message someone deleted while you were reading elsewhere would come back from the dead. Saved history is now kept current in the background for every channel, not just the one you have open, and anything older than a day is no longer shown as if it were current.

  <!-- whatsnew
  title: Faster, fresher messages
  icon: rewind-fill
  body: Channels now load up-to-date messages much sooner, and no longer show conversations that have fallen behind.
  kind: fix
  -->

- 0e459f3: Keeps popups out of the screen's safe areas on tablets.
- fe04ee1: Fixes phantom ping badges. Opening a channel that only had unread messages turned the white unread dot into a red ping badge, and marking the channel as read could not clear it. The client now only applies ping arithmetic to mention and reply notifications instead of every unseen message, and never increments a count it did not decrement. Marking a channel, category, or community as read also resyncs the badge from the server, so a stale count can always be cleared without reloading. The "message that caused this ping has been deleted" banner no longer appears for ordinary unread messages.

  <!-- whatsnew
  title: Ping Badge Fixes
  icon: bell-ringing-fill
  body: Channels no longer show a red ping badge for ordinary unread messages, and marking a channel as read reliably clears it.
  kind: fix
  -->

- 7696331: Adds support for team and play store tester labels and auto updating on supported platforms
- 042f2c0: Fixes emoji and text input related issues
- 5cdb331: fix: Show a disclaimer for returning users in the profile setup that their old data is safe
- 7379b04: Only community members can send messages: the composer is disabled with a clear reason for anyone without an admission record, and accepting an invite now waits for the community to confirm the join before opening it.
- e48ba9b: Fixes a race condition in the deep link listener that caused logins to not work as intended.
- 5160d9f: Adds better handling for the status changing mechanism
- ddfd10c: Fixes badge labels issuing one request per user. Every rendered name used to hit the labeler separately, so opening a large member list or a role mention popover fired dozens of requests at once. Names rendered without a badge no longer request one at all, the rest are coalesced into a single batched query, and a failed lookup no longer hides badges for fifteen minutes.

  <!-- whatsnew
  title: Faster member lists
  icon: lightning-fill
  body: Member lists and role popovers no longer stall while badges load.
  kind: fix
  -->

- 5383a82: Right-clicking or long-pressing a message author's avatar or name now opens the member menu instead of the message menu. The member menu hides role assignment and kick/ban for authors who are no longer part of the community, and message rows now highlight on desktop while their own menu is open, matching mobile.
- 99e3e50: Fixes the Settings dialog (and every other modal/popover/drawer built on the same primitive) rendering with clipped text and mis-centering on iPad-width screens, flagged during App Store review. Dialogs no longer size themselves off the viewport width, which was the root cause on tablet-sized screens, long channel names now truncate instead of overlapping the mute/member-list buttons at narrower chat widths.
- 93374b8: Fix voice channels failing to connect in the macOS app. When voice setup does fail, the app now clears the "Connecting" state and shows an error instead of spinning forever, and reports the failure so it can be diagnosed.

  <!-- whatsnew
  title: MacOS voice channel issues
  icon: speaker-high-fill
  body: MacOS users rejoice! You can finally join voice channels again.
  kind: fix
  -->

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

- 244c83e: Colibri on macOS, Windows and Linux now draws its own window title bar instead of using the plain system one, so the desktop app has the same branded header as the web app. The bar shows the community and channel you're in, and that same name is now what you see in the taskbar, in Alt-Tab and in Mission Control.
  There's a new "Use system window controls" switch in Settings under Preferences to go back to native controls.

  Also fixes the video viewer on desktop, which used a stand-in fullscreen mode that ignored Escape, and stops a trackpad pinch-zoom from shifting the whole app down.

  <!-- whatsnew
  title: A window title bar of our own
  icon: browser-fill
  body: The desktop app now has the same branded header as the web app, with the channel you're in shown in the title bar and the taskbar.
  kind: feature
  -->

- 0c87079: Fixes an error that would occur if a session got only partially removed
- 7696331: Adds support for custom badges and auto-updating where supported, and fixes an issue where mobile invite modals would overflow
- 8ddea05: Stops the message composer from auto-focusing (and popping the on-screen keyboard) on mobile when opening or switching channels
- 75bfff8: Fixes an issue where navigating to a community which no longer existed (or the user no longer had access to) resulting in a crash and subsequent soft-lock
- 5855f50: Fixes mobile drawers only opening when the user released a press instead of when they pressed for long enough
- 7ae9314: Fixes broken atproto.at links on profile cards
- c57c2ea: Make `tsc --noEmit` pass on the client: enable `skipLibCheck`, fix the duplicate-key spreads in the voice member-state updates, type the uploaded-files reset as `Set<File>`, return an `ArrayBuffer`-backed `Uint8Array` from the VAPID key decoder, and add type declarations for the assets package's `node` and `vite-verbatim-noise` entries. No runtime behaviour changes.
- 3f1f55d: Fixes missing padding for the toaster component
- ec472e1: Adds proper error handling and a timeout to the login screen
- dc43c69: Adds swipe controls to lightbox carousel
- 0ec83ae: Fixes a crash that would occur when clicking on an invite link in-app in the native apps.
- 985043a: Fixes an issue with the debug buttons not opening outside the app
- 297bf92: Adds support for web push notifications for all messages
- 7696331: Fixes the invite link creation modal not fitting mobile screens by rendering it as a bottom drawer on mobile instead of a centered dialog.
- 0f3daca: Fixes the "Jump to latest" button in channels staying visible after being clicked
- 3560f64: fix: Channel now scrolls to the latest message when opening it for the first time on mobile
- e7b2afe: Fixes a crash on mobile layouts causing you to be unable to delete messages.
- 9becfc4: Fixes an issue that caused the keyboard to be displyed on the member and channel lists in certain cases
- 733fa34: Improves blockquote handling

  <!-- whatsnew
  title: Blockquotes
  icon: quotes-fill
  body: Improves the way blockquotes are handled in the chat input
  kind: fix
  -->

- b3c9635: Moves twemoji to tauri bundled resources
- c57c2ea: Fix XRPC wrappers sending the literal string `undefined` for omitted optional query parameters (`listRecords`, `listMessages`, `listNotifications`, `updateSeen`), and percent-encode the credentials passed to `registerCredentials` so a password containing `&` or `=` can no longer truncate the request or inject query parameters.
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

- 5412688: Fades the top safe area to the darker pane color when the channel list is off screen on mobile. The shell painted that strip with the same color as the community rail at all times, so opening a channel left a light band across the top of an otherwise dark view. The strip now tracks the pane carousel, crossfading in step with the rail as you swipe.

  <!-- whatsnew
  title: Mind the gap
  icon: device-mobile-fill
  body: The area around the notch now matches whichever view you are on, so there is no light band left over the top of a channel.
  kind: fix
  -->

- 733fa34: Fixes three mobile swipe issues: a pane could stay partly on screen when swiping back, swiping was dead in channels containing an overflowing message, and swiping stuttered in communities with large member lists. Turning on swipe-to-reply now also disables swipe-to-open-members entirely, so the two gestures no longer compete — the member list stays reachable from the channel header
- 2cdb3cf: Fixes sourcemap generation and adjusts the publish workflow to upload them to Sentry
- 4536e73: Fixes issues with reactions not being applied, as well as empty attachment notifications
- 5019928: Improves wording and flow around community creation to be less technical
- 7cd245e: Improves typing UX by adjusting line height and typing indicator
- 27b383b: Resizes the sign-in screen when the on-screen keyboard opens on phones. The screen lives outside the app shell, so it never picked up the shell's keyboard handling and the handle input ended up behind the keyboard. It now tracks the same visual viewport height and the same keyboard spring as the rest of the app.

  <!-- whatsnew
  title: This you?
  icon: keyboard-fill
  body: The sign-in screen now moves out of the way when the on-screen keyboard opens, so the handle field stays visible while you type.
  kind: fix
  -->

- cb3eaa4: Improves swipe controls
- dff7523: Link the Colibri Features feedback board on userinput.app from the About settings page and the welcome screen.

  <!-- whatsnew
  title: Vote on upcoming features
  icon: lightbulb-fill
  body: Colibri now has a public feedback board on userinput.app. Find it under Settings > About to request features and vote on what we build next.
  kind: feature
  -->

- ec91e45: Fixes pasted images being attached twice. The browser exposes a clipboard image through two clipboard APIs at once, and the composer collected it from both, so a single paste produced two identical attachment chips. The extractor now recognizes the second copy and keeps only one file per pasted image.

  <!-- whatsnew
  title: Pasted images attach once
  icon: image-fill
  body: Pasting a screenshot or copied image into the message box added it twice. Now it lands as a single attachment, the way you would expect.
  kind: fix
  -->

- 9dedb4a: Hides the "support" page in the settings on apps which get distributed to app stores

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
