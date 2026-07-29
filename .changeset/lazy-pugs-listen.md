---
"@colibri-social/client": patch
"@colibri-social/lib": patch
"@colibri-social/website": patch
---

Fixes the list of members shown in a voice channel being wrong: people who had already left lingering in the list, people who were connected missing from it, and mute or deafen badges disappearing. The member list the AppView returns when a community loads is now treated as the source of truth and re-applied whenever fresh data arrives, so a join or leave missed while the connection was down repairs itself instead of staying wrong for the rest of the session. This was most noticeable right after joining a community, where none of a channel's voice activity showed up at all.

Also fixes leaving a call clearing everyone else's mute and deafen icons, moderator-applied server mutes not showing until the next voice event, and a member's voice channel from one community leaking into another community's sidebar.

<!-- whatsnew
title: Accurate voice channel member lists
icon: users-three-fill
body: Voice channels now show exactly who is in them, and keep it accurate through connection drops.
kind: fix
-->
