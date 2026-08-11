---
"@colibri-social/client": patch
---

Stop treating a dropped connection while opening a channel as a crash worth reporting. The channel already shows a retry when it cannot be loaded, so a request that times out or never leaves the device no longer files an error report as well.
