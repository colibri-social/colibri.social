---
"@colibri-social/app": minor
---

Voice calls in a Space on another server now connect to that server. The call gets its token for that server and picks among that server's voice nodes, and the voice debug panel shows that server's nodes.

The app keeps each other server's node list on the device for 10 minutes, so a new session or a reopened socket skips listing and measuring that server's nodes again.
