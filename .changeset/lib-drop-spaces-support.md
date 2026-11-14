---
"@colibri-social/lib": minor
---

Removes `supportsSpaces` and `clearSpacesSupportCache`. Sign-in no longer checks whether the account's provider supports spaces, and the AppView reports that through `social.colibri.beta.polyfill.getStatus`.

A provider that answers a `com.atproto.space.*` call with "No service configured for", as the reference PDS does when it has no space methods, now classifies as `SpacesUnsupported`.
