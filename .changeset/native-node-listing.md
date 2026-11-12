---
"@colibri-social/app": patch
"@colibri-social/wrapper": patch
---

List and measure the Colibri nodes on macOS and Android. The native shell sends the node listing and the `/health` probes through the Tauri HTTP plugin, and the wrapper allows `server.listNodes` on `spaces-api.colibri.social` and `/health` on `*.nodes.colibri.social`. A failed probe logs its error code at debug level.
