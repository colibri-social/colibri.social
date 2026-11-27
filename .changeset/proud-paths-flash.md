---
"@colibri-social/app": patch
---

Grants access to your synced preferences again right away when another server reports that it has none, even if the app remembers an earlier grant. This happens at most once per server per session. When another server reports a later expiry than the app remembers, the app keeps that expiry. Signing out removes the remembered values from the device.
