---
"@colibri-social/client": minor
---

Moderating a community hosted on a different AppView now works. Only the AppView holding a community's credentials can write to its repo, so until now banning, kicking, hiding a message, approving a join, leaving, or editing channels, categories, roles and settings all failed if you were signed in to a different AppView than the one hosting that community. The failure surfaced as a generic server error that got retried eight times before giving up, because nothing recognised it as a permanent routing problem. Your AppView now recognises that a community belongs to another one and forwards the request there on your behalf, returning that AppView's own answer. Your browser only ever talks to your own AppView, so the one hosting the community never sees your connection.

The AppView you use is published on your public profile when presence sharing is on, and the AppView hosting a community checks it before accepting anything on your behalf, so nobody else's AppView can act as you. That means presence sharing has to be on to moderate a community hosted elsewhere. The presence setting and AppView picker now say so, the member and banned-user screens of a community hosted elsewhere warn you up front if you can moderate it but have presence sharing off, turning the setting off warns you that it breaks moderation elsewhere and offers to undo, and if an action is refused for that reason you get a prompt to turn it back on, once per session, with a button to stop showing it.

Also fixes an AppView that no longer administers a community being able to keep writing to it with credentials it still held, and two error codes that were declared to clients but could never actually be sent.

<!-- whatsnew
title: Moderation across AppViews
icon: shield-check-fill
body: You can now moderate and manage communities hosted on a different AppView than the one you signed in to. This needs presence sharing on, which is what tells other AppViews yours is allowed to act for you.
kind: feature
-->
