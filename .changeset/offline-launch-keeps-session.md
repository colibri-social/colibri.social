---
"@colibri-social/app": patch
"@colibri-social/lib": patch
---

Keep you signed in when the network drops. Without a connection, the app opens from what's saved on this device and reconnects once the network is back. Only a refused or revoked sign-in sends you back to the sign-in screen, and access tokens refresh only when they're close to expiring.
