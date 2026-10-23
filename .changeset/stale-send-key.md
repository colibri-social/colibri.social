---
"@colibri-social/app": patch
"@colibri-social/lib": patch
---

Give a message that waited in the outbox for more than 23 hours a fresh key right before it sends, so the server doesn't refuse it as backdated. The waiting message, its channel preview, and replies to it move to the new key, and the new key survives an app restart.
