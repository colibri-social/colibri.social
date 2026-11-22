---
"@colibri-social/app": patch
"@colibri-social/ui": patch
---

Load custom emoji you haven't seen before in one batched request, and keep trying custom emoji that failed to load: after a short delay, when the network comes back, and when the window regains focus. Emoji no longer stay missing until you restart the app. Animated custom status emoji in the member list now stay still until you hover the member. Custom emoji in messages retry the same way, emoji you've seen show right away on the next launch, and an animated status emoji in a profile plays while the profile is open.
