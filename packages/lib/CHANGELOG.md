# @colibri-social/lib

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
