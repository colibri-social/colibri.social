---
"@colibri-social/client": patch
"@colibri-social/wrapper": patch
---

Address the Play Console and App Store Connect recommendations: raise the iOS deployment target to 15.0, load notification images through Glide so they are downsampled and cached instead of decoded at full resolution, enable resource shrinking for Android release builds, and drive edge-to-edge from theme attributes so the system bar icons follow the app theme.
