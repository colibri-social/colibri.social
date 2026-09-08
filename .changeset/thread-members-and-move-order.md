---
"@colibri-social/client": minor
"@colibri-social/website": patch
---

Show the member list beside a full-screen thread, filtered to who may read that thread, with a toggle in the thread header. Moving messages now keeps them in the order they were sent, reading among the destination's own messages by send time, and is restricted to members who may move messages. A moved message can go back where it came from even when that was a thread, which previously offered no way back. Fixes the move request dropping the subject collection, which made every move fail
