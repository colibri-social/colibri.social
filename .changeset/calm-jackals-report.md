---
"@colibri-social/client": patch
---

Makes error tracking group failures by what went wrong rather than by the exact wording of the message. One fault could previously show up as several separate entries whenever the server included something variable in its reply, such as a session identifier or a link, which made a single problem look like many and hid how often it really happened. Unknown failures still separate by where they came from, so nothing distinct gets merged.
