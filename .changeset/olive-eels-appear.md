---
"@colibri-social/wrapper": patch
"@colibri-social/client": patch
---

Signs in inside the app on iOS. The authorization page now opens in a native web authentication sheet, the same one macOS already used, instead of switching over to Safari and waiting for a deep link to come back. If the sheet cannot be presented, the old browser handoff still takes over.
