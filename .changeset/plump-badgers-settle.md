---
"@colibri-social/client": patch
---

Checking whether the desktop and mobile apps are allowed to show notifications can no longer crash the page it happens on. When the operating system refuses that check, the app now treats notifications as switched off and carries on, instead of surfacing an unexplained failure. In-app messages still appear as before.
