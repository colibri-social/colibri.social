---
"@colibri-social/app": minor
---

After sign-in, the app adds its AppView to the user's `social.colibri.beta.actor.appview` record. Joining a Space that another AppView manages writes an `actor.remoteSpace` record to the preferences space, and the app grants each such AppView access to the preferences space. Leaving the Space, or being removed from it, deletes the record. Deleting your Colibri data also deletes both kinds of record
