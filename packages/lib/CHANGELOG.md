# @colibri-social/lib

## 0.2.0

### Minor Changes

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

### Patch Changes

- 75e5b3b: Scopes What's New entries to the platforms they apply to. Every whatsnew block in a changeset now carries a required `platforms:` key holding a comma-separated list of `web`, `ios`, `android`, `macos`, `windows` and `linux`, with `all`, `mobile` and `desktop` as shorthands. The in-app popup and the What's New settings page render only the entries that name the platform the app is running on, and the App Store and Play release notes are rendered per platform through a new required `--platform` flag, falling back to a generic line when a release has nothing for that store.

## 0.1.0

### Minor Changes

- 1a88b5d: Add community banners

  <!-- whatsnew
  title: Community banners
  icon: image-fill
  body: Set a community banner to be displayed in the channel sidebar.
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

- 764a8bc: Adds new badge types, a preferred badge selector, and a support page
- 66c6c75: Rework channel message scrolling around a single anchor controller

  <!-- whatsnew
  title: Smoother Older Message Loading
  icon: arrow-line-up-fill
  body: Scrolling up to load older messages in a channel no longer jumps your view around, and late-loading images no longer shift what you are reading.
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

- 5258c62: Fixes issues related to FCM notifications and pings in-app
- 7058ba3: Fixes issues with banners: users were unable to remove pictures and banners, and banners in the UI wouldn't live-update.

  <!-- whatsnew
  title: Live Banner Updates
  icon: image-fill
  body: Updates made to a community's banner are now shown right away.
  kind: fix
  -->

- 297bf92: Adds support for web push notifications for all messages
- 733fa34: Improves blockquote handling

  <!-- whatsnew
  title: Blockquotes
  icon: quotes-fill
  body: Improves the way blockquotes are handled in the chat input
  kind: fix
  -->

- 618b27f: Fixes formatting markers being scrambled when a message is reopened for editing. A list item that started with an inline style came back inside out (`- **Test**` turned into `**- Test**`), which also corrupted the facets once the edit was saved. Headings and subtext were affected the same way whenever the inline style covered only part of the line, and copying a styled list item to the clipboard produced the same wrong text.

  <!-- whatsnew
  title: Editing formatted lists
  icon: list-bullets-fill
  body: Editing a message that contains a bold or italic list item no longer scrambles the formatting.
  kind: fix
  -->

## 0.1.0-rc.6

### Patch Changes

- 66c6c75: Rework channel message scrolling around a single anchor controller

  <!-- whatsnew
  title: Smoother Older Message Loading
  icon: arrow-line-up-fill
  body: Scrolling up to load older messages in a channel no longer jumps your view around, and late-loading images no longer shift what you are reading.
  kind: fix
  -->

## 0.1.0-rc.5

### Patch Changes

- 36cc84a: Fixes the list of members shown in a voice channel being wrong: people who had already left lingering in the list, people who were connected missing from it, and mute or deafen badges disappearing. The member list the AppView returns when a community loads is now treated as the source of truth and re-applied whenever fresh data arrives, so a join or leave missed while the connection was down repairs itself instead of staying wrong for the rest of the session. This was most noticeable right after joining a community, where none of a channel's voice activity showed up at all.

  Also fixes leaving a call clearing everyone else's mute and deafen icons, moderator-applied server mutes not showing until the next voice event, and a member's voice channel from one community leaking into another community's sidebar.

  <!-- whatsnew
  title: Accurate voice channel member lists
  icon: users-three-fill
  body: Voice channels now show exactly who is in them, and keep it accurate through connection drops.
  kind: fix
  -->

- 618b27f: Fixes formatting markers being scrambled when a message is reopened for editing. A list item that started with an inline style came back inside out (`- **Test**` turned into `**- Test**`), which also corrupted the facets once the edit was saved. Headings and subtext were affected the same way whenever the inline style covered only part of the line, and copying a styled list item to the clipboard produced the same wrong text.

  <!-- whatsnew
  title: Editing formatted lists
  icon: list-bullets-fill
  body: Editing a message that contains a bold or italic list item no longer scrambles the formatting.
  kind: fix
  -->

## 0.1.0-rc.4

### Patch Changes

- 7058ba3: Fixes issues with banners: users were unable to remove pictures and banners, and banners in the UI wouldn't live-update.

  <!-- whatsnew
  title: Live Banner Updates
  icon: image-fill
  body: Updates made to a community's banner are now shown right away.
  kind: fix
  -->

## 0.1.0-rc.3

### Minor Changes

- 1a88b5d: Add community banners

  <!-- whatsnew
  title: Community banners
  icon: image-fill
  body: Set a community banner to be displayed in the channel sidebar.
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

- 733fa34: Improves blockquote handling

  <!-- whatsnew
  title: Blockquotes
  icon: quotes-fill
  body: Improves the way blockquotes are handled in the chat input
  kind: fix
  -->

## 0.0.2-rc.2

### Patch Changes

- 5258c62: Fixes issues related to FCM notifications and pings in-app

## 0.0.2-rc.1

### Patch Changes

- 764a8bc: Adds new badge types, a preferred badge selector, and a support page

## 0.0.2-rc.0

### Patch Changes

- 297bf92: Adds support for web push notifications for all messages
