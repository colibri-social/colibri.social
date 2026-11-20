---
"@colibri-social/website": patch
"@colibri-social/app": patch
---

Split the documentation into a Users and a Developers area with their own sidebars and start pages. Rewrote the pages against the current client and AppView, generated the AppView method reference from the lexicons, added guides for roles, notifications, voice, settings, storage, hosting and local development with Snowglobe, and redirected every old docs URL. The desktop updater endpoint has one route per platform, so docs pages load on the dev server. The client reads the PLC directory from `VITE_COLIBRI_PLC_URL`, so it can sign in to accounts on a local network.
