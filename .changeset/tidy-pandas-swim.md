---
"@colibri-social/client": patch
---

Fixes three mobile swipe issues: a pane could stay partly on screen when swiping back, swiping was dead in channels containing an overflowing message, and swiping stuttered in communities with large member lists. Turning on swipe-to-reply now also disables swipe-to-open-members entirely, so the two gestures no longer compete — the member list stays reachable from the channel header
