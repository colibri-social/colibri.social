---
"@colibri-social/client": patch
---

Merge a settings change over the write still waiting in the outbox rather than over the stored record, so changing your notification level and reordering your communities in quick succession no longer drops the earlier of the two
