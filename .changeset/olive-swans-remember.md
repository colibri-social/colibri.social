---
"@colibri-social/client": patch
---

Staying pinned to the bottom of a channel is no longer a matter of luck. Sending a message reliably scrolls you down to it, and on mobile the list now keeps up with the chat input as it grows from one line to five, and with the keyboard as it slides in and out.

The old behaviour guessed at whether you wanted to be at the bottom by looking at where the list happened to sit whenever it received a scroll event. Growing the chat input never produces one, so a single unlucky guess earlier in the session would leave the newest message sliding out of sight behind the composer, with nothing able to correct it. Whether you were pinned is now something the app records when you actually ask for it, by sending a message, by tapping "Jump to latest", or by ending a scroll near the bottom, and it holds that position across the several frames it takes images, link previews and quoted posts to settle.

Deleting a message no longer strands the list either. Previously, if the deleted message was the one the list was holding on to, every later correction silently stopped working for the rest of the session. Bluesky quotes, GIFs and link previews now also reserve their height before they load, so messages arriving underneath you push the view around far less.

<!-- whatsnew
title: Channels stay pinned to the bottom
icon: arrow-down-fill
body: Sending a message now reliably scrolls you to it, and the list keeps its place as the chat input grows and the keyboard opens.
platforms: all
kind: fix
-->
