---
"@colibri-social/client": minor
"@colibri-social/wrapper": minor
---

Fixes desktop notifications never appearing and adds an unread badge to the macOS dock. The notification plugin always reports permission as granted on desktop, so the code that switches notifications on after a successful prompt never ran and the setting stayed off unless you found the toggle in settings yourself. Desktop now opts in once on first launch, and turning it off still sticks. In-app toasts also stopped appearing entirely once notifications were on, even with the window focused, so those are back whenever the window is in front. On macOS notifications are now delivered through the system notification centre: they carry the sender's avatar, group per channel, open the right message when clicked, and disappear once the message is read. Windows notifications are now native toasts carrying the sender's avatar that open the right message when clicked. Windows does not group by channel and does not clear a toast once the message is read, since the toast API exposes no way to do either.

<!-- whatsnew
title: Desktop notifications
icon: bell-ringing-fill
body: Desktop notifications no longer need to be switched on by hand, and on macOS and Windows they show the sender's avatar and take you straight to the message. Your unread mention count now shows on the macOS dock icon.
kind: feature
-->
