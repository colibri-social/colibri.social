---
"@colibri-social/client": patch
---

Fix XRPC wrappers sending the literal string `undefined` for omitted optional query parameters (`listRecords`, `listMessages`, `listNotifications`, `updateSeen`), and percent-encode the credentials passed to `registerCredentials` so a password containing `&` or `=` can no longer truncate the request or inject query parameters.
