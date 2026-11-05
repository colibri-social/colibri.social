---
"@colibri-social/app": patch
"@colibri-social/lib": minor
---

Show each reaction on the message it was meant for, even when two people's messages in a channel share a record key. New reactions and replies also carry the full record URI of their message. `buildMessageRecord` takes an optional `space` and writes `parentUri`, `buildReactionRecord` takes an optional `space` and writes `uri`, and `parseSpaceRecordUri` and `sameSpaceRecordRef` read those URIs back
