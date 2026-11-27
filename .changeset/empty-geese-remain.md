---
"@colibri-social/app": patch
"@colibri-social/lib": patch
"@colibri-social/website": patch
---

Moves to `@colibri-social/lexicons` 2.46.0, which publishes the federation lexicons. The app now takes the `actor.appview` and `actor.remoteSpace` NSIDs and the federation fields of `listCommunities` and `getCommunity` from the lexicons. The website's lexicon reference includes the federation methods and records, the AppView specification lists the `social.colibri.beta.federation` methods and the `federation` feature, and the federation page covers `NotJoined`, `ActingForNotAllowed`, the blocks and mutes a receiving AppView applies, and the delivery retry rules.
