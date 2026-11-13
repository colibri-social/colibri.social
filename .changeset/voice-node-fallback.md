---
"@colibri-social/app": patch
"@colibri-social/ui": patch
---

Calls now switch to another voice server on their own when the first one can't take the call. If no server works, a notice says calls are having trouble and offers "Try again". A call that drops mid-call reconnects to a different server when one is available. The connection tile in the call panel can open a new "Call details" dialog with live connection details and a "Copy all" button.
