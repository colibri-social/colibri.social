---
"@colibri-social/client": patch
---

Report XRPC failures more accurately: a dropped connection is no longer filed as a malformed response, a replayed DPoP proof is retried instead of ending the session, failed link previews stay out of the error log, and one AppView outage groups as one issue instead of one per lexicon method
