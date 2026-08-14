---
"@colibri-social/client": minor
---

Right-clicking a link now offers actions for that link. Every message body is wrapped in a single context menu trigger, so a right-click anywhere in a message, including on a URL, used to open the message menu with nothing but Reply, Copy Text and Delete. There was no way to copy a link without selecting its text by hand.

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
