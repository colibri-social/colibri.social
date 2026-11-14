---
"@colibri-social/app": patch
"@colibri-social/lib": patch
"@colibri-social/website": patch
---

Update the AT Protocol Spaces packages to the November 12 alpha, `0.0.0-spaces-alpha-20261112204144`, and carry the `@atproto/oauth-client-browser` patch over to it. `@colibri-social/lexicons` moves to 2.38.0, which names space types with `title` and adds lexicons for `sync.subscribeEvents`, `voice.subscribeSignals`, `embed.getImage` and `embed.getVideo`. The architecture, self-hosting, development and AppView specification docs describe the November 12 flows: `com.atproto.managedspace.checkAccess`, `com.atproto.space.authorizeSpaceSync` with notification registration, `confirmRegistration`, `notifySpaceUpdate`, `listWriters`, and MACs as HTTP Message Signatures.
