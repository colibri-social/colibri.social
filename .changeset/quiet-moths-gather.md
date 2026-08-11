---
"@colibri-social/client": patch
---

The microphone test in Voice settings now tells you when it cannot open an input device instead of failing silently and leaving the test button stuck. Picking a different noise suppression mode while the test is running recovers the same way.

Unread badge polling and the community list also stop treating an ordinary dropped connection as a fault worth reporting, so a brief loss of signal no longer fills the error log with noise.
