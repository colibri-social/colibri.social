---
"@colibri-social/client": minor
"@colibri-social/lib": minor
"@colibri-social/website": minor
---

Adds control over link previews at every level. Authors can hide the preview on a link they posted, one at a time or all at once, and bring it back later. A new dismiss button appears on hover over a preview card, and a Link Previews entry in the message menu lists every link so previews can be reviewed and restored. A toggle in the composer sets whether previews are attached before a message is sent, seeded from a new preference for what that toggle should default to.

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
