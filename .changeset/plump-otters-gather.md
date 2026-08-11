---
"@colibri-social/client": patch
---

Ignores incomplete cached community data when opening a community. A cache entry written by an older version of the app could be missing its channel, role or member lists, which made parts of the community screen fail to render until a reload.
