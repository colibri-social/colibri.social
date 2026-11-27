---
"@colibri-social/app": patch
---

Cuts repeated calls to other servers:

- The app remembers when each server's access to your synced preferences runs out. It grants access again only when that time is nearly up.
- The app checks at most once a day that your account lists this server.
- While a Space can't be reached, the app checks again after 1, 2, 5 and then every 10 minutes. The wait starts over at 1 minute when you return to the window or choose "Try again".
