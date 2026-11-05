---
"@colibri-social/app": minor
"@colibri-social/ui": minor
"@colibri-social/lib": minor
"@colibri-social/client": patch
"@colibri-social/website": patch
---

Add private user blocking. Block someone from the member menu, the member drawer or their profile, after a confirmation, and manage the list on the new Blocked users settings page. A blocked person's messages collapse into an anonymous "Message from someone you blocked" row that you can reveal and hide again. Replies to them stay clickable and show their content once the parent is revealed. They leave the member list, the typing indicator and mention suggestions, and channel and thread previews mask their messages. Their notifications stop pinging, alerting and counting toward unread totals and the badge, including notifications already received. Blocks sync through the personal preferences space and the AppView's `putBlocks` procedure.

Move to `@colibri-social/lexicons` 2.36.0 and use its generated types for blocks, `putBlocks`, the `activity` sync frame, the voice `setConsumerPreference` frame, reaction `uri` and message `parentUri`, replacing the local stopgaps. The voice strip height helpers move to `@colibri-social/lib` so plain TypeScript modules can use them without loading UI components.
