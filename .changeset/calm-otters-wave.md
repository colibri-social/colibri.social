---
"@colibri-social/app": minor
"@colibri-social/ui": minor
"@colibri-social/lib": patch
"@colibri-social/wrapper": patch
"@colibri-social/website": patch
---

Add the "Add reactions" permission. Members can react in channels where they can't write, and Space admins can turn reactions off for a role or member in a channel or category. When reactions are off, the reaction buttons, the emoji picker and double-tap to react are hidden. The roles and moderation docs list the new permission. "Send messages" also covers voice channel chats, so a channel override that denies it makes the chat read-only while members can still react, and "See text chat" only lets members read it.

Save video GIFs from Tenor, Giphy and X posts as favorites, and play them as looping videos in the GIF picker. Saving and removing a favorite from a message and from the picker match the same GIF.

Keep the fullscreen button inside narrow video players when the volume slider opens. Videos the Linux desktop app can't play, such as H.264 and HEVC recordings, offer "Open in video player", which shows download progress on the tile and then opens them in the system's default player. Failed playback logs the error code and MIME type.
