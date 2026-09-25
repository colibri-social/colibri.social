---
"@colibri-social/client": patch
---

Fixes a crash that kept a community from loading when one of its online members had a status and no live activity. A TypeError from a code bug now shows as an unexpected error instead of "The connection dropped", and uncaught render errors log the failing method and cause
